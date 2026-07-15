import { sql, type SQL } from "drizzle-orm"
import { db } from "@/lib/db"
import { COMMON_INTERVIEW_QUESTIONS, resolveQuestionDefinition } from "@/lib/interview/question-catalog"
import { extractProfileFactDrafts as canonicalExtractProfileFactDrafts } from "@/lib/interview/profile-facts"
import type {
  InterviewQuestionCategory,
  ProfileFactDraft,
  QuestionDefinition,
} from "@/lib/interview/types"

export type { InterviewQuestionCategory, ProfileFactDraft, QuestionDefinition } from "@/lib/interview/types"

export type InterviewQuestionSourceType = "built_in" | "custom" | "application_generated"
export type InterviewFactSourceType = "cv" | "manual" | "discovery"
export type StorySourceType = "manual" | "discovery"

export interface EvidenceSnapshot {
  factIds: string[]
  storyIds: string[]
  generatedAt: string
}

export interface InterviewQuestionView {
  id: string | null
  key: string
  text: string
  category: InterviewQuestionCategory
  sourceType: InterviewQuestionSourceType
  sourceRef: string
  applicationId: string | null
  requiresStory: boolean
  evidenceTags: string[]
  createdAt: string | null
  updatedAt: string | null
}

export interface InterviewAnswerView {
  id: string
  questionId: string
  applicationId: string | null
  content: string
  evidenceSnapshot: EvidenceSnapshot | null
  status: "draft" | "saved"
  createdAt: string
  updatedAt: string
  evidenceStale: boolean
}

export interface InterviewProfileFactView {
  id: string
  category: string
  label: string
  detail: string
  sourceType: InterviewFactSourceType
  sourceRef: string | null
  confirmedAt: string | null
  createdAt: string
  updatedAt: string
  isCurrentSource: boolean
}

export interface StoryEntry {
  id: string
  title: string
  situation: string | null
  task: string | null
  action: string | null
  result: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
  sourceType?: StorySourceType
  sourceRef?: string | null
  confirmedAt?: string | null
  answerCount?: number
}

export interface InterviewWorkspaceData {
  questions: InterviewQuestionView[]
  answers: InterviewAnswerView[]
  facts: InterviewProfileFactView[]
  stories: StoryEntry[]
  applications: InterviewApplicationView[]
  selectedApplicationId: string | null
  applicationContextError: string | null
  cvFactDrafts: ProfileFactDraft[]
  applicationCvFactDrafts: ApplicationCvFactDraftGroup[]
}

export interface InterviewApplicationView {
  id: string
  title: string
  company: string
  hasResearch: boolean
}

export interface ApplicationCvFactDraftGroup {
  applicationId: string
  customizedCvId: string
  generatedAt: string
  facts: ProfileFactDraft[]
}

interface PersistedQuestionRow {
  id: string
  userId: string
  applicationId: string | null
  text: string
  category: string
  sourceType: InterviewQuestionSourceType | string
  sourceRef: string | null
  createdAt: unknown
  updatedAt: unknown
}

interface PersistedAnswerRow {
  id: string
  questionId: string
  applicationId: string | null
  content: string
  evidenceSnapshot: unknown
  status: "draft" | "saved" | string
  createdAt: unknown
  updatedAt: unknown
}

interface PersistedFactRow {
  id: string
  category: string
  label: string
  detail: string
  sourceType: InterviewFactSourceType | string
  sourceRef: string | null
  confirmedAt: unknown
  createdAt: unknown
  updatedAt: unknown
}

interface PersistedStoryRow {
  id: string
  title: string
  situation: string | null
  task: string | null
  action: string | null
  result: string | null
  tags: string[] | null
  sourceType: StorySourceType | string | null
  sourceRef: string | null
  confirmedAt: unknown
  createdAt: unknown
  updatedAt: unknown
}

interface PersistedApplicationRow {
  id: string
  title: string | null
  company: string | null
  description: string | null
  researchContent: string | null
  createdAt: unknown
}

interface PersistedCvRow {
  id: string
  parsedJson: unknown
}

interface PersistedApplicationCvRow {
  id: string
  applicationId: string
  cvJson: unknown
  createdAt: unknown
}

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

function readRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (!result || typeof result !== "object") return []

  const maybeRows = (result as { rows?: unknown; data?: unknown }).rows ?? (result as { data?: unknown }).data
  return Array.isArray(maybeRows) ? (maybeRows as T[]) : []
}

async function queryRows<T>(statement: SQL): Promise<T[]> {
  return readRows<T>(await db.execute(statement))
}

async function queryOne<T>(statement: SQL): Promise<T | null> {
  return (await queryRows<T>(statement))[0] ?? null
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.toISOString() === value
}

function uniqueStrings(values: unknown, max: number): string[] | null {
  if (!Array.isArray(values) || values.length > max) return null
  const next: string[] = []
  for (const value of values) {
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    if (!trimmed || next.includes(trimmed)) return null
    next.push(trimmed)
  }
  return next
}

function toIso(value: unknown): string | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function sortByUpdatedAtThenId<T extends { id: string; updatedAt: unknown }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const updatedComparison = (toIso(right.updatedAt) ?? "").localeCompare(toIso(left.updatedAt) ?? "")
    if (updatedComparison !== 0) return updatedComparison
    return right.id.localeCompare(left.id)
  })
}

function sortByCreatedAtThenId<T extends { id: string; createdAt: unknown }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => {
    const createdComparison = (toIso(right.createdAt) ?? "").localeCompare(toIso(left.createdAt) ?? "")
    if (createdComparison !== 0) return createdComparison
    return right.id.localeCompare(left.id)
  })
}

function buildQuestionView(definition: QuestionDefinition, row: PersistedQuestionRow | null): InterviewQuestionView {
  return {
    id: row?.id ?? null,
    key: definition.key,
    text: definition.text,
    category: definition.category,
    sourceType:
      row?.sourceType === "built_in" || row?.sourceType === "custom" || row?.sourceType === "application_generated"
        ? row.sourceType
        : "built_in",
    sourceRef: row?.sourceRef ?? definition.key,
    applicationId: row?.applicationId ?? null,
    requiresStory: definition.requiresStory,
    evidenceTags: [...definition.evidenceTags],
    createdAt: toIso(row?.createdAt),
    updatedAt: toIso(row?.updatedAt),
  }
}

function buildQuestionViews(rows: PersistedQuestionRow[]): InterviewQuestionView[] {
  const byStableKey = new Map(rows.map((row) => [row.sourceRef ?? row.id, row] as const))
  const consumed = new Set<string>()

  const builtIns = COMMON_INTERVIEW_QUESTIONS.map((definition) => {
    const row = byStableKey.get(definition.key) ?? null
    if (row) consumed.add(row.id)
    return buildQuestionView(definition, row)
  })

  const extras = rows
    .filter((row) => !consumed.has(row.id))
    .sort((left, right) => {
      const updatedComparison = (toIso(right.updatedAt) ?? "").localeCompare(toIso(left.updatedAt) ?? "")
      if (updatedComparison !== 0) return updatedComparison
      return right.id.localeCompare(left.id)
    })
    .map((row) =>
      buildQuestionView(
        resolveQuestionDefinition({
          key: row.sourceRef ?? row.id,
          text: row.text,
          category: row.category as InterviewQuestionCategory,
        }),
        row,
      ),
    )

  return [...builtIns, ...extras]
}

function parseEvidenceSnapshot(value: unknown): EvidenceSnapshot | null {
  const snapshot = parseMaybeJson(value)
  if (!snapshot || typeof snapshot !== "object") return null

  const record = snapshot as Record<string, unknown>
  const factIds = uniqueStrings(record.factIds, 6)
  const storyIds = uniqueStrings(record.storyIds, 3)
  const generatedAt = record.generatedAt

  if (!factIds || !storyIds || !isValidIsoTimestamp(generatedAt)) return null

  return {
    factIds,
    storyIds,
    generatedAt,
  }
}

function buildFactView(row: PersistedFactRow, currentCvRefs: Set<string>): InterviewProfileFactView {
  return {
    id: row.id,
    category: row.category,
    label: row.label,
    detail: row.detail,
    sourceType: row.sourceType === "cv" || row.sourceType === "manual" || row.sourceType === "discovery" ? row.sourceType : "manual",
    sourceRef: row.sourceRef,
    confirmedAt: toIso(row.confirmedAt),
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date(0).toISOString(),
    isCurrentSource: row.sourceType === "cv" ? currentCvRefs.has(row.sourceRef ?? "") : true,
  }
}

function buildStoryView(row: PersistedStoryRow, answerCount: number): StoryEntry {
  return {
    id: row.id,
    title: row.title,
    situation: row.situation,
    task: row.task,
    action: row.action,
    result: row.result,
    tags: row.tags ?? [],
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toIso(row.updatedAt) ?? new Date(0).toISOString(),
    sourceType: row.sourceType === "discovery" ? "discovery" : "manual",
    sourceRef: row.sourceRef,
    confirmedAt: toIso(row.confirmedAt),
    answerCount,
  }
}

function buildStoryAnswerCounts(answers: PersistedAnswerRow[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const answer of answers) {
    if (answer.status !== "saved") continue
    const snapshot = parseEvidenceSnapshot(answer.evidenceSnapshot)
    if (!snapshot) continue
    for (const storyId of new Set(snapshot.storyIds)) {
      counts.set(storyId, (counts.get(storyId) ?? 0) + 1)
    }
  }
  return counts
}

function buildAnswerStaleState(
  answer: PersistedAnswerRow,
  factById: Map<string, InterviewProfileFactView>,
  storyById: Map<string, StoryEntry>,
  currentCvRefs: Set<string>,
): { evidenceSnapshot: EvidenceSnapshot | null; evidenceStale: boolean } {
  const snapshot = parseEvidenceSnapshot(answer.evidenceSnapshot)
  if (!snapshot) return { evidenceSnapshot: null, evidenceStale: true }

  const generatedAt = new Date(snapshot.generatedAt).getTime()

  for (const factId of snapshot.factIds) {
    const fact = factById.get(factId)
    if (!fact) return { evidenceSnapshot: snapshot, evidenceStale: true }
    const factUpdatedAt = new Date(fact.updatedAt).getTime()
    if (Number.isNaN(factUpdatedAt) || factUpdatedAt > generatedAt) {
      return { evidenceSnapshot: snapshot, evidenceStale: true }
    }
    if (fact.sourceType === "cv" && fact.sourceRef && !currentCvRefs.has(fact.sourceRef)) {
      return { evidenceSnapshot: snapshot, evidenceStale: true }
    }
    if (fact.sourceType === "cv" && !fact.sourceRef) {
      return { evidenceSnapshot: snapshot, evidenceStale: true }
    }
  }

  for (const storyId of snapshot.storyIds) {
    const story = storyById.get(storyId)
    if (!story) return { evidenceSnapshot: snapshot, evidenceStale: true }
    const storyUpdatedAt = new Date(story.updatedAt).getTime()
    if (Number.isNaN(storyUpdatedAt) || storyUpdatedAt > generatedAt) {
      return { evidenceSnapshot: snapshot, evidenceStale: true }
    }
  }

  return { evidenceSnapshot: snapshot, evidenceStale: false }
}

export function extractProfileFactDrafts(cv: unknown): ProfileFactDraft[] {
  return canonicalExtractProfileFactDrafts(cv as never)
}

async function loadPrimaryCvDrafts(userId: string): Promise<{ row: PersistedCvRow | null; drafts: ProfileFactDraft[] }> {
  const row = await queryOne<PersistedCvRow>(sql`
    SELECT id, parsed_json AS "parsedJson"
    FROM user_cvs
    WHERE user_id = ${userId} AND is_primary = true
    ORDER BY created_at DESC
    LIMIT 1
  `)

  const parsed = parseMaybeJson(row?.parsedJson) as Parameters<typeof canonicalExtractProfileFactDrafts>[0]
  return {
    row,
    drafts: row ? canonicalExtractProfileFactDrafts(parsed ?? null) : [],
  }
}

function applicationCvDraft(applicationId: string, draft: ProfileFactDraft): ProfileFactDraft {
  return {
    ...draft,
    logicalSourceRef: `application-cv:${applicationId}:${draft.logicalSourceRef}`,
    sourceRef: `application-cv:${applicationId}:${draft.sourceRef}`,
  }
}

export async function loadApplicationInterviewCvDrafts(userId: string): Promise<ApplicationCvFactDraftGroup[]> {
  const rows = await queryRows<PersistedApplicationCvRow>(sql`
    SELECT DISTINCT ON (application_id)
      id,
      application_id AS "applicationId",
      cv_json AS "cvJson",
      created_at AS "createdAt"
    FROM customized_cvs
    WHERE user_id = ${userId} AND application_id IS NOT NULL
    ORDER BY application_id, created_at DESC, id DESC
  `)

  return rows.flatMap((row) => {
    const parsed = parseMaybeJson(row.cvJson) as Parameters<typeof canonicalExtractProfileFactDrafts>[0]
    const facts = canonicalExtractProfileFactDrafts(parsed ?? null).map((draft) =>
      applicationCvDraft(row.applicationId, draft),
    )
    if (facts.length === 0) return []

    return [
      {
        applicationId: row.applicationId,
        customizedCvId: row.id,
        generatedAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
        facts,
      },
    ]
  })
}

export async function loadAllInterviewCvFactDrafts(userId: string): Promise<ProfileFactDraft[]> {
  const [primary, applicationGroups] = await Promise.all([
    loadPrimaryCvDrafts(userId),
    loadApplicationInterviewCvDrafts(userId),
  ])

  return [
    ...primary.drafts,
    ...applicationGroups.flatMap((group) => group.facts),
  ]
}

export async function loadInterviewQuestionRows(userId: string): Promise<PersistedQuestionRow[]> {
  return queryRows<PersistedQuestionRow>(sql`
    SELECT
      id,
      user_id AS "userId",
      application_id AS "applicationId",
      text,
      category,
      source_type AS "sourceType",
      source_ref AS "sourceRef",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM interview_questions
    WHERE user_id = ${userId}
  `)
}

export async function loadInterviewQuestionById(userId: string, questionId: string): Promise<PersistedQuestionRow | null> {
  return queryOne<PersistedQuestionRow>(sql`
    SELECT
      id,
      user_id AS "userId",
      application_id AS "applicationId",
      text,
      category,
      source_type AS "sourceType",
      source_ref AS "sourceRef",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM interview_questions
    WHERE user_id = ${userId} AND id = ${questionId}
    LIMIT 1
  `)
}

export async function loadInterviewApplicationById(userId: string, applicationId: string): Promise<PersistedApplicationRow | null> {
  return queryOne<PersistedApplicationRow>(sql`
    SELECT
      applications.id,
      COALESCE(jobs_cache.title, 'Untitled role') AS title,
      COALESCE(jobs_cache.company, 'Unknown company') AS company,
      COALESCE(applications.custom_description, jobs_cache.description, '') AS description,
      interview_prep.research_content AS "researchContent",
      applications.created_at AS "createdAt"
    FROM applications
    LEFT JOIN jobs_cache ON applications.job_id = jobs_cache.id
    LEFT JOIN interview_prep ON interview_prep.application_id = applications.id
    WHERE applications.user_id = ${userId} AND applications.id = ${applicationId}
    LIMIT 1
  `)
}

export async function loadInterviewFacts(userId: string): Promise<PersistedFactRow[]> {
  return sortByUpdatedAtThenId(
    await queryRows<PersistedFactRow>(sql`
    SELECT
      id,
      category,
      label,
      detail,
      source_type AS "sourceType",
      source_ref AS "sourceRef",
      confirmed_at AS "confirmedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM interview_profile_facts
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC, id DESC
  `),
  )
}

export async function loadInterviewFactById(userId: string, id: string): Promise<PersistedFactRow | null> {
  return queryOne<PersistedFactRow>(sql`
    SELECT
      id,
      category,
      label,
      detail,
      source_type AS "sourceType",
      source_ref AS "sourceRef",
      confirmed_at AS "confirmedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM interview_profile_facts
    WHERE user_id = ${userId} AND id = ${id}
    LIMIT 1
  `)
}

export async function loadInterviewStories(userId: string): Promise<PersistedStoryRow[]> {
  return sortByUpdatedAtThenId(
    await queryRows<PersistedStoryRow>(sql`
    SELECT
      id,
      title,
      situation,
      task,
      action,
      result,
      tags,
      source_type AS "sourceType",
      source_ref AS "sourceRef",
      confirmed_at AS "confirmedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM story_bank
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC, id DESC
  `),
  )
}

export async function loadInterviewStoryById(userId: string, id: string): Promise<PersistedStoryRow | null> {
  return queryOne<PersistedStoryRow>(sql`
    SELECT
      id,
      title,
      situation,
      task,
      action,
      result,
      tags,
      source_type AS "sourceType",
      source_ref AS "sourceRef",
      confirmed_at AS "confirmedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM story_bank
    WHERE user_id = ${userId} AND id = ${id}
    LIMIT 1
  `)
}

export async function loadInterviewAnswers(userId: string): Promise<PersistedAnswerRow[]> {
  return sortByUpdatedAtThenId(
    await queryRows<PersistedAnswerRow>(sql`
    SELECT
      id,
      question_id AS "questionId",
      application_id AS "applicationId",
      content,
      evidence_snapshot AS "evidenceSnapshot",
      status,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM interview_answers
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC, id DESC
  `),
  )
}

async function importLegacyApplicationQuestions(userId: string): Promise<void> {
  await db.execute(sql`
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
    SELECT
      applications.user_id,
      applications.id,
      LEFT(BTRIM(legacy_questions.question_text), 2000),
      'custom',
      'application_generated',
      CONCAT(applications.id::text, ':legacy-prep:', legacy_questions.ordinal::text),
      NOW(),
      NOW()
    FROM applications
    INNER JOIN interview_prep ON interview_prep.application_id = applications.id
    CROSS JOIN LATERAL UNNEST(COALESCE(interview_prep.questions, ARRAY[]::text[]))
      WITH ORDINALITY AS legacy_questions(question_text, ordinal)
    WHERE applications.user_id = ${userId}
      AND BTRIM(legacy_questions.question_text) <> ''
    ON CONFLICT DO NOTHING
  `)
}

export async function loadInterviewAnswerById(userId: string, id: string): Promise<PersistedAnswerRow | null> {
  return queryOne<PersistedAnswerRow>(sql`
    SELECT
      id,
      question_id AS "questionId",
      application_id AS "applicationId",
      content,
      evidence_snapshot AS "evidenceSnapshot",
      status,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM interview_answers
    WHERE user_id = ${userId} AND id = ${id}
    LIMIT 1
  `)
}

export async function loadInterviewWorkspace(
  userId: string,
  requestedApplicationId?: string | null,
): Promise<InterviewWorkspaceData> {
  await importLegacyApplicationQuestions(userId)

  const [questionRows, answerRows, factRows, storyRows, applicationRows, cvResult, applicationCvFactDrafts] = await Promise.all([
    loadInterviewQuestionRows(userId),
    loadInterviewAnswers(userId),
    loadInterviewFacts(userId),
    loadInterviewStories(userId),
    queryRows<PersistedApplicationRow>(sql`
      SELECT
        applications.id,
        COALESCE(jobs_cache.title, 'Untitled role') AS title,
        COALESCE(jobs_cache.company, 'Unknown company') AS company,
        COALESCE(applications.custom_description, jobs_cache.description, '') AS description,
        interview_prep.research_content AS "researchContent",
        applications.created_at AS "createdAt"
      FROM applications
      LEFT JOIN jobs_cache ON applications.job_id = jobs_cache.id
      LEFT JOIN interview_prep ON interview_prep.application_id = applications.id
      WHERE applications.user_id = ${userId}
      ORDER BY applications.created_at DESC, applications.id DESC
    `),
    loadPrimaryCvDrafts(userId),
    loadApplicationInterviewCvDrafts(userId),
  ])

  const cvFactDrafts = cvResult.drafts
  const currentCvRefs = new Set([
    ...cvFactDrafts.map((draft) => draft.sourceRef),
    ...applicationCvFactDrafts.flatMap((group) => group.facts.map((draft) => draft.sourceRef)),
  ])

  const facts = factRows.map((row) => buildFactView(row, currentCvRefs))
  const factById = new Map(facts.map((fact) => [fact.id, fact] as const))

  const storiesAnswerCounts = buildStoryAnswerCounts(answerRows)
  const stories = storyRows.map((row) => buildStoryView(row, storiesAnswerCounts.get(row.id) ?? 0))
  const storyById = new Map(stories.map((story) => [story.id, story] as const))

  const answers = answerRows.map((row) => {
    const { evidenceSnapshot, evidenceStale } = buildAnswerStaleState(row, factById, storyById, currentCvRefs)
    return {
      id: row.id,
      questionId: row.questionId,
      applicationId: row.applicationId,
      content: row.content,
      evidenceSnapshot,
      status: row.status === "saved" ? ("saved" as const) : ("draft" as const),
      createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
      updatedAt: toIso(row.updatedAt) ?? new Date(0).toISOString(),
      evidenceStale,
    }
  })

  const questions = buildQuestionViews(questionRows)
  const applications = sortByCreatedAtThenId(applicationRows)
    .map((row) => ({
      id: row.id,
      title: trim(row.title) || "Untitled role",
      company: trim(row.company) || "Unknown company",
      hasResearch: Boolean(trim(row.researchContent)),
      createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    }))
    .map(({ createdAt, ...application }) => {
      void createdAt
      return application
    })
  const normalizedRequestedApplicationId = trim(requestedApplicationId)
  const selectedApplicationId = normalizedRequestedApplicationId
    ? applications.some((application) => application.id === normalizedRequestedApplicationId)
      ? normalizedRequestedApplicationId
      : null
    : null
  const applicationContextError =
    normalizedRequestedApplicationId && !selectedApplicationId
      ? "That application could not be loaded, so Interview Prep opened in general mode."
      : null

  return {
    questions,
    answers,
    facts,
    stories,
    applications,
    selectedApplicationId,
    applicationContextError,
    cvFactDrafts,
    applicationCvFactDrafts,
  }
}

export async function loadInterviewQuestionMap(userId: string): Promise<Map<string, PersistedQuestionRow>> {
  const rows = await loadInterviewQuestionRows(userId)
  return new Map(rows.map((row) => [row.id, row] as const))
}

export async function loadInterviewApplicationMap(userId: string): Promise<Map<string, PersistedApplicationRow>> {
  const rows = await queryRows<PersistedApplicationRow>(sql`
    SELECT
      applications.id,
      COALESCE(jobs_cache.title, 'Untitled role') AS title,
      COALESCE(jobs_cache.company, 'Unknown company') AS company,
      COALESCE(applications.custom_description, jobs_cache.description, '') AS description,
      interview_prep.research_content AS "researchContent",
      applications.created_at AS "createdAt"
    FROM applications
    LEFT JOIN jobs_cache ON applications.job_id = jobs_cache.id
    LEFT JOIN interview_prep ON interview_prep.application_id = applications.id
    WHERE applications.user_id = ${userId}
  `)
  return new Map(rows.map((row) => [row.id, row] as const))
}

export async function loadPrimaryInterviewCvDrafts(userId: string): Promise<ProfileFactDraft[]> {
  return (await loadPrimaryCvDrafts(userId)).drafts
}

export async function loadInterviewStoryMap(userId: string): Promise<Map<string, PersistedStoryRow>> {
  const rows = await loadInterviewStories(userId)
  return new Map(rows.map((row) => [row.id, row] as const))
}
