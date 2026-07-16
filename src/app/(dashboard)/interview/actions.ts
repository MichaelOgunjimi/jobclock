"use server"

import { and, eq, inArray, sql, type SQL } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { db } from "@/lib/db"
import { storyBank } from "@/lib/db/schema"
import {
  loadInterviewApplicationById,
  loadInterviewFacts,
  loadInterviewQuestionById,
  loadInterviewStories,
  loadInterviewWorkspace,
  loadAllInterviewCvFactDrafts,
  type EvidenceSnapshot,
  type InterviewQuestionCategory,
  type InterviewQuestionSourceType,
  type StoryEntry,
} from "./data"
import { COMMON_INTERVIEW_QUESTIONS_BY_KEY, resolveQuestionDefinition } from "@/lib/interview/question-catalog"
import type { ProfileFactCategory } from "@/lib/interview/types"

export type { StoryEntry } from "./data"

const MAX_QUESTION_LENGTH = 2000
const MAX_ANSWER_LENGTH = 5000
const MAX_STORY_TITLE_LENGTH = 200
const MAX_STORY_FIELD_LENGTH = 5000
const MAX_FACT_LABEL_LENGTH = 200
const MAX_FACT_DETAIL_LENGTH = 5000
const MAX_TAG_LENGTH = 80
const MAX_TAGS = 20
const MAX_EVIDENCE_FACT_IDS = 6
const MAX_EVIDENCE_STORY_IDS = 3

const VALID_QUESTION_CATEGORIES = new Set<InterviewQuestionCategory>([
  "opening",
  "motivation",
  "strengths",
  "resilience",
  "teamwork",
  "leadership",
  "initiative",
  "pressure",
  "mistakes",
  "custom",
])

const VALID_SOURCE_TYPES = new Set<InterviewQuestionSourceType>([
  "built_in",
  "custom",
  "application_generated",
])

const CANONICAL_FACT_CATEGORIES = new Set<ProfileFactCategory>([
  "summary",
  "education",
  "experience",
  "project",
  "skill",
  "certification",
  "activity",
  "language",
])

const VALID_INTERVIEW_FACT_CATEGORIES = new Set<string>([
  ...CANONICAL_FACT_CATEGORIES,
  "achievement",
  "strengths",
  "goals",
  "personal_context",
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object"
}

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

type ValidationOk<T> = { value: T; error?: never }
type ValidationError = { error: string; value?: never }
type ValidationResult<T> = ValidationOk<T> | ValidationError

function normalizeText(
  label: string,
  value: unknown,
  maxLength: number,
  options: { required?: boolean } = {},
): ValidationResult<string> {
  const text = trim(value)
  if (!text) {
    return options.required === false ? { value: "" } : { error: `${label} is required` }
  }
  if (text.length > maxLength) return { error: `${label} is too long` }
  return { value: text }
}

function normalizeTags(value: unknown): ValidationResult<string[]> {
  if (value == null) return { value: [] }
  if (!Array.isArray(value)) return { error: "Tags are invalid" }
  if (value.length > MAX_TAGS) return { error: "Tags are invalid" }

  const tags: string[] = []
  for (const rawTag of value) {
    const tag = trim(rawTag)
    if (!tag || tag.length > MAX_TAG_LENGTH || tags.includes(tag)) {
      return { error: "Tags are invalid" }
    }
    tags.push(tag)
  }

  return { value: tags }
}

function normalizeEvidenceSnapshot(value: unknown): ValidationResult<EvidenceSnapshot> {
  if (!isRecord(value)) return { error: "Evidence snapshot is invalid" }
  const factIds = value.factIds
  const storyIds = value.storyIds
  const generatedAt = value.generatedAt

  if (!Array.isArray(factIds) || !Array.isArray(storyIds)) {
    return { error: "Evidence snapshot is invalid" }
  }
  if (factIds.length > MAX_EVIDENCE_FACT_IDS || storyIds.length > MAX_EVIDENCE_STORY_IDS) {
    return { error: "Evidence snapshot is invalid" }
  }

  const normalizedFactIds: string[] = []
  for (const factId of factIds) {
    const id = trim(factId)
    if (!id || normalizedFactIds.includes(id)) return { error: "Evidence snapshot is invalid" }
    normalizedFactIds.push(id)
  }

  const normalizedStoryIds: string[] = []
  for (const storyId of storyIds) {
    const id = trim(storyId)
    if (!id || normalizedStoryIds.includes(id)) return { error: "Evidence snapshot is invalid" }
    normalizedStoryIds.push(id)
  }

  if (!isCanonicalIsoTimestamp(generatedAt)) {
    return { error: "Evidence snapshot is invalid" }
  }

  return {
    value: {
      factIds: normalizedFactIds,
      storyIds: normalizedStoryIds,
      generatedAt,
    },
  }
}

function isCanonicalIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.toISOString() === value
}

function readRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (!result || typeof result !== "object") return []
  const maybeRows = (result as { rows?: unknown; data?: unknown }).rows ?? (result as { data?: unknown }).data
  return Array.isArray(maybeRows) ? (maybeRows as T[]) : []
}

async function executeRows<T>(executor: { execute: (statement: SQL) => Promise<unknown> }, statement: SQL): Promise<T[]> {
  return readRows<T>(await executor.execute(statement))
}

async function executeOne<T>(executor: { execute: (statement: SQL) => Promise<unknown> }, statement: SQL): Promise<T | null> {
  return (await executeRows<T>(executor, statement))[0] ?? null
}

async function getAuthenticatedUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function requireAuthenticatedUserId(): Promise<string | { error: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }
  return user.id
}

function validateQuestionCategory(category: unknown): category is InterviewQuestionCategory {
  return typeof category === "string" && VALID_QUESTION_CATEGORIES.has(category as InterviewQuestionCategory)
}

function validateSourceType(sourceType: unknown): sourceType is InterviewQuestionSourceType {
  return typeof sourceType === "string" && VALID_SOURCE_TYPES.has(sourceType as InterviewQuestionSourceType)
}

function isAllowedFactCategory(value: unknown): value is string {
  return typeof value === "string" && VALID_INTERVIEW_FACT_CATEGORIES.has(value.trim())
}

async function ensureOwnedApplication(userId: string, applicationId: string | null | undefined) {
  if (!applicationId) return null
  return loadInterviewApplicationById(userId, applicationId)
}

export async function listStories(): Promise<StoryEntry[]> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return []
  return (await loadInterviewWorkspace(userId)).stories
}

export async function createQuestion(input: {
  text: string
  category: InterviewQuestionCategory
  sourceType?: InterviewQuestionSourceType
  sourceRef?: string
  applicationId?: string | null
}): Promise<{ id: string } | { error: string }> {
  const auth = await requireAuthenticatedUserId()
  if (typeof auth !== "string") return auth

  if (!validateQuestionCategory(input.category)) return { error: "Category is invalid" }
  const sourceType = input.sourceType ?? "custom"
  if (!validateSourceType(sourceType)) return { error: "Source type is invalid" }

  const applicationId = trim(input.applicationId)
  const ownedApplication = await ensureOwnedApplication(auth, applicationId || null)
  if (applicationId && !ownedApplication) return { error: "Application not found" }

  let text = trim(input.text)
  let category: InterviewQuestionCategory = input.category
  let sourceRef: string | null = trim(input.sourceRef) || null

  if (sourceType === "built_in") {
    if (!sourceRef) return { error: "Question not found" }
    const builtIn = COMMON_INTERVIEW_QUESTIONS_BY_KEY.get(sourceRef)
    if (!builtIn) return { error: "Question not found" }
    const resolved = resolveQuestionDefinition({
      key: builtIn.key,
      text: builtIn.text,
      category: builtIn.category,
    })
    text = resolved.text
    category = resolved.category
    sourceRef = resolved.key
  } else if (sourceType === "application_generated") {
    if (!applicationId) return { error: "Application not found" }
    if (!sourceRef) return { error: "Source ref is required" }
    if (!sourceRef.startsWith(`${applicationId}:`)) {
      return { error: `Source ref must start with ${applicationId}:` }
    }
  } else {
    const validation = normalizeText("Question", text, MAX_QUESTION_LENGTH)
    if ("error" in validation) return { error: validation.error as string }
    text = validation.value ?? ""
    if (!text) return { error: "Question is required" }
    if (sourceRef && sourceRef.length > 200) return { error: "Source ref is too long" }
  }

  if (sourceType !== "built_in") {
    const validation = normalizeText("Question", text, MAX_QUESTION_LENGTH)
    if ("error" in validation) return { error: validation.error as string }
    text = validation.value ?? ""
  }

  const inserted = await executeRows<{ id: string }>(db, sql`
    INSERT INTO interview_questions (
      user_id,
      application_id,
      text,
      category,
      source_type,
      source_ref,
      created_at,
      updated_at
    )
    VALUES (
      ${auth},
      ${applicationId || null},
      ${text},
      ${category},
      ${sourceType},
      ${sourceRef},
      NOW(),
      NOW()
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `)

  if (inserted[0]) {
    revalidatePath("/interview")
    return { id: inserted[0].id }
  }

  const existing = await executeOne<{ id: string }>(db, sql`
    SELECT id
    FROM interview_questions
    WHERE user_id = ${auth}
      AND source_type = ${sourceType}
      AND source_ref IS NOT DISTINCT FROM ${sourceRef}
      ${sourceType === "application_generated" ? sql`AND application_id = ${applicationId}` : sql``}
    LIMIT 1
  `)

  if (!existing) return { error: "Failed to save question" }
  revalidatePath("/interview")
  return { id: existing.id }
}

export async function saveAnswer(input: {
  questionId: string
  applicationId: string | null
  content: string
  evidenceSnapshot: EvidenceSnapshot
}): Promise<{ id: string } | { error: string }> {
  const auth = await requireAuthenticatedUserId()
  if (typeof auth !== "string") return auth

  const content = trim(input.content)
  if (!content) return { error: "Answer is required" }
  if (content.length > MAX_ANSWER_LENGTH) return { error: "Answer is too long" }

  const questionId = trim(input.questionId)
  if (!questionId) return { error: "Question is required" }
  const applicationId = trim(input.applicationId)

  const question = await loadInterviewQuestionById(auth, questionId)
  if (!question) return { error: "Question not found" }

  if (applicationId) {
    const application = await loadInterviewApplicationById(auth, applicationId)
    if (!application) return { error: "Application not found" }
  }

  const evidence = normalizeEvidenceSnapshot(input.evidenceSnapshot)
  if ("error" in evidence) return { error: evidence.error as string }

  const facts = await loadInterviewFacts(auth)
  const stories = await loadInterviewStories(auth)
  const factById = new Map(facts.map((fact) => [fact.id, fact] as const))
  const storyById = new Map(stories.map((story) => [story.id, story] as const))

  for (const factId of evidence.value!.factIds) {
    if (!factById.has(factId)) return { error: "Evidence contains missing or foreign ids" }
  }
  for (const storyId of evidence.value!.storyIds) {
    if (!storyById.has(storyId)) return { error: "Evidence contains missing or foreign ids" }
  }

  const inserted = await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE interview_answers
      SET status = 'draft', updated_at = NOW()
      WHERE user_id = ${auth}
        AND question_id = ${questionId}
        AND status = 'saved'
        AND ${
          applicationId
            ? sql`application_id = ${applicationId}`
            : sql`application_id IS NULL`
        }
    `)

    return executeRows<{ id: string }>(tx, sql`
      INSERT INTO interview_answers (
        user_id,
        question_id,
        application_id,
        content,
        evidence_snapshot,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${auth},
        ${questionId},
        ${applicationId || null},
        ${content},
        ${JSON.stringify(evidence.value)}::jsonb,
        'saved',
        NOW(),
        NOW()
      )
      RETURNING id
    `)
  })

  if (!inserted[0]) return { error: "Failed to save answer" }
  revalidatePath("/interview")
  return { id: inserted[0].id }
}

export async function confirmProfileFacts(
  selected: Array<{ sourceRef: string }>,
): Promise<{ inserted: number } | { error: string }> {
  const auth = await requireAuthenticatedUserId()
  if (typeof auth !== "string") return auth

  const drafts = await loadAllInterviewCvFactDrafts(auth)
  if (drafts.length === 0) return { inserted: 0 }

  const selectedRefs = new Set(
    selected
      .map((item) => trim(item.sourceRef))
      .filter((value): value is string => !!value),
  )

  let inserted = 0
  await db.transaction(async (tx) => {
    for (const draft of drafts) {
      if (!selectedRefs.has(draft.sourceRef)) continue
      const rows = await executeRows<{ id: string }>(tx, sql`
        INSERT INTO interview_profile_facts (
          user_id,
          category,
          label,
          detail,
          source_type,
          source_ref,
          confirmed_at,
          created_at,
          updated_at
        )
        VALUES (
          ${auth},
          ${draft.category},
          ${draft.label},
          ${draft.detail},
          ${draft.sourceType},
          ${draft.sourceRef},
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id, source_type, source_ref) DO NOTHING
        RETURNING id
      `)
      if (rows[0]) inserted += 1
    }
  })

  revalidatePath("/interview")
  return { inserted }
}

export async function createProfileFact(input: {
  category: string
  label: string
  detail: string
}): Promise<{ id: string } | { error: string }> {
  const auth = await requireAuthenticatedUserId()
  if (typeof auth !== "string") return auth

  const category = trim(input.category)
  if (!isAllowedFactCategory(category)) return { error: "Category is invalid" }
  const label = normalizeText("Label", input.label, MAX_FACT_LABEL_LENGTH)
  if ("error" in label) return { error: label.error as string }
  const detail = normalizeText("Detail", input.detail, MAX_FACT_DETAIL_LENGTH)
  if ("error" in detail) return { error: detail.error as string }

  const rows = await executeRows<{ id: string }>(db, sql`
    INSERT INTO interview_profile_facts (
      user_id,
      category,
      label,
      detail,
      source_type,
      confirmed_at,
      created_at,
      updated_at
    )
    VALUES (
      ${auth},
      ${category},
      ${label.value},
      ${detail.value},
      'manual',
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id
  `)

  if (!rows[0]) return { error: "Failed to save fact" }
  revalidatePath("/interview")
  return { id: rows[0].id }
}

export async function updateProfileFact(
  id: string,
  input: { category: string; label: string; detail: string },
): Promise<{ error?: string }> {
  const auth = await requireAuthenticatedUserId()
  if (typeof auth !== "string") return auth

  const categoryValue = trim(input.category)
  if (!isAllowedFactCategory(categoryValue)) return { error: "Category is invalid" }
  const label = normalizeText("Label", input.label, MAX_FACT_LABEL_LENGTH)
  if ("error" in label) return { error: label.error as string }
  const detail = normalizeText("Detail", input.detail, MAX_FACT_DETAIL_LENGTH)
  if ("error" in detail) return { error: detail.error as string }

  const rows = await executeRows<{ id: string }>(db, sql`
    UPDATE interview_profile_facts
    SET category = ${categoryValue},
        label = ${label.value},
        detail = ${detail.value},
        updated_at = NOW()
    WHERE id = ${id} AND user_id = ${auth}
    RETURNING id
  `)

  if (!rows[0]) return { error: "Fact not found" }
  revalidatePath("/interview")
  return {}
}

export async function deleteProfileFact(id: string): Promise<{ error?: string }> {
  const auth = await requireAuthenticatedUserId()
  if (typeof auth !== "string") return auth

  const rows = await executeRows<{ id: string }>(db, sql`
    DELETE FROM interview_profile_facts
    WHERE id = ${id} AND user_id = ${auth}
    RETURNING id
  `)

  if (!rows[0]) return { error: "Fact not found" }
  revalidatePath("/interview")
  return {}
}

export async function confirmStory(id: string): Promise<{ error?: string }> {
  const auth = await requireAuthenticatedUserId()
  if (typeof auth !== "string") return auth

  const rows = await executeRows<{ id: string }>(db, sql`
    UPDATE story_bank
    SET confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = ${id} AND user_id = ${auth}
    RETURNING id
  `)

  if (!rows[0]) return { error: "Story not found" }
  revalidatePath("/interview")
  return {}
}

export async function confirmDiscoveredStory(input: {
  title: string
  situation: string
  task: string
  action: string
  result: string
  tags: string[]
}): Promise<{ id: string } | { error: string }> {
  const auth = await requireAuthenticatedUserId()
  if (typeof auth !== "string") return auth

  const title = normalizeText("Title", input.title, MAX_STORY_TITLE_LENGTH)
  if ("error" in title) return { error: title.error as string }
  const situation = normalizeText("Situation", input.situation, MAX_STORY_FIELD_LENGTH)
  if ("error" in situation) return { error: situation.error as string }
  const task = normalizeText("Task", input.task, MAX_STORY_FIELD_LENGTH)
  if ("error" in task) return { error: task.error as string }
  const action = normalizeText("Action", input.action, MAX_STORY_FIELD_LENGTH)
  if ("error" in action) return { error: action.error as string }
  const result = normalizeText("Result", input.result, MAX_STORY_FIELD_LENGTH)
  if ("error" in result) return { error: result.error as string }
  const tags = normalizeTags(input.tags)
  if ("error" in tags) return { error: tags.error as string }

  const rows = await executeRows<{ id: string }>(db, sql`
    INSERT INTO story_bank (
      user_id,
      title,
      situation,
      task,
      action,
      result,
      tags,
      source_type,
      confirmed_at,
      created_at,
      updated_at
    )
    VALUES (
      ${auth},
      ${title.value},
      ${situation.value},
      ${task.value},
      ${action.value},
      ${result.value},
      ${tags.value},
      'discovery',
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id
  `)

  if (!rows[0]) return { error: "Failed to save story" }
  revalidatePath("/interview")
  return { id: rows[0].id }
}

export async function createStory(data: {
  title: string
  situation?: string
  task?: string
  action?: string
  result?: string
  tags?: string[]
}): Promise<{ id: string } | { error: string }> {
  const auth = await requireAuthenticatedUserId()
  if (typeof auth !== "string") return auth

  const title = normalizeText("Title", data.title, MAX_STORY_TITLE_LENGTH)
  if ("error" in title) return { error: title.error as string }
  const situation = normalizeText("Situation", data.situation, MAX_STORY_FIELD_LENGTH, { required: false })
  if ("error" in situation) return { error: situation.error as string }
  const task = normalizeText("Task", data.task, MAX_STORY_FIELD_LENGTH, { required: false })
  if ("error" in task) return { error: task.error as string }
  const action = normalizeText("Action", data.action, MAX_STORY_FIELD_LENGTH, { required: false })
  if ("error" in action) return { error: action.error as string }
  const result = normalizeText("Result", data.result, MAX_STORY_FIELD_LENGTH, { required: false })
  if ("error" in result) return { error: result.error as string }
  const tags = normalizeTags(data.tags)
  if ("error" in tags) return { error: tags.error as string }

  const rows = await executeRows<{ id: string }>(db, sql`
    INSERT INTO story_bank (
      user_id,
      title,
      situation,
      task,
      action,
      result,
      tags,
      source_type,
      confirmed_at,
      created_at,
      updated_at
    )
    VALUES (
      ${auth},
      ${title.value},
      ${situation.value || null},
      ${task.value || null},
      ${action.value || null},
      ${result.value || null},
      ${tags.value},
      'manual',
      NOW(),
      NOW(),
      NOW()
    )
    RETURNING id
  `)

  if (!rows[0]) return { error: "Failed to save story" }
  revalidatePath("/interview")
  return { id: rows[0].id }
}

export async function updateStory(
  id: string,
  data: {
    title?: string
    situation?: string
    task?: string
    action?: string
    result?: string
    tags?: string[]
  },
): Promise<{ error?: string }> {
  const auth = await requireAuthenticatedUserId()
  if (typeof auth !== "string") return auth

  const nextTitle =
    data.title !== undefined ? normalizeText("Title", data.title, MAX_STORY_TITLE_LENGTH) : null
  if (nextTitle && "error" in nextTitle) return { error: nextTitle.error as string }

  const nextSituation =
    data.situation !== undefined
      ? normalizeText("Situation", data.situation, MAX_STORY_FIELD_LENGTH, { required: false })
      : null
  if (nextSituation && "error" in nextSituation) return { error: nextSituation.error as string }

  const nextTask =
    data.task !== undefined
      ? normalizeText("Task", data.task, MAX_STORY_FIELD_LENGTH, { required: false })
      : null
  if (nextTask && "error" in nextTask) return { error: nextTask.error as string }

  const nextAction =
    data.action !== undefined
      ? normalizeText("Action", data.action, MAX_STORY_FIELD_LENGTH, { required: false })
      : null
  if (nextAction && "error" in nextAction) return { error: nextAction.error as string }

  const nextResult =
    data.result !== undefined
      ? normalizeText("Result", data.result, MAX_STORY_FIELD_LENGTH, { required: false })
      : null
  if (nextResult && "error" in nextResult) return { error: nextResult.error as string }

  const nextTags = data.tags !== undefined ? normalizeTags(data.tags) : null
  if (nextTags && "error" in nextTags) return { error: nextTags.error as string }

  const rows = await db
    .update(storyBank)
    .set({
      ...(nextTitle ? { title: nextTitle.value } : {}),
      ...(nextSituation ? { situation: nextSituation.value || null } : {}),
      ...(nextTask ? { task: nextTask.value || null } : {}),
      ...(nextAction ? { action: nextAction.value || null } : {}),
      ...(nextResult ? { result: nextResult.value || null } : {}),
      ...(nextTags ? { tags: nextTags.value } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(storyBank.id, id), eq(storyBank.userId, auth)))
    .returning({ id: storyBank.id })

  if (!rows[0]) return { error: "Story not found" }
  revalidatePath("/interview")
  return {}
}

export async function deleteStory(id: string): Promise<{ error?: string }> {
  const auth = await requireAuthenticatedUserId()
  if (typeof auth !== "string") return auth

  const rows = await executeRows<{ id: string }>(db, sql`
    DELETE FROM story_bank
    WHERE id = ${id} AND user_id = ${auth}
    RETURNING id
  `)

  if (!rows[0]) return { error: "Story not found" }

  revalidatePath("/interview")
  return {}
}

export async function importSampleStories(): Promise<{ imported: number } | { error: string }> {
  const auth = await requireAuthenticatedUserId()
  if (typeof auth !== "string") return auth

  const { SAMPLE_STORIES } = await import("@/lib/jobs/sample-stories")

  const sampleTitles = SAMPLE_STORIES.map((story) => story.title)
  const existing = await db
    .select({ title: storyBank.title })
    .from(storyBank)
    .where(and(eq(storyBank.userId, auth), inArray(storyBank.title, sampleTitles)))

  const existingTitles = new Set(existing.map((row) => row.title))
  const toInsert = SAMPLE_STORIES.filter((story) => !existingTitles.has(story.title))

  if (toInsert.length === 0) return { imported: 0 }

  const rows = await db
    .insert(storyBank)
    .values(
      toInsert.map((story) => ({
        userId: auth,
        title: story.title,
        situation: story.situation,
        task: story.task,
        action: story.action,
        result: story.result,
        tags: story.tags,
      })),
    )
    .returning({ id: storyBank.id })

  revalidatePath("/interview")
  return { imported: rows.length }
}
