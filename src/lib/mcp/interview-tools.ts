import { and, count, desc, eq, isNull, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications, interviewAnswers, interviewPrep, interviewProfileFacts, interviewQuestions, storyBank } from "@/lib/db/schema"
import {
  isAllowedFactCategory,
  MAX_FACT_DETAIL_LENGTH,
  MAX_FACT_LABEL_LENGTH,
  MAX_STORY_FIELD_LENGTH,
  MAX_STORY_TITLE_LENGTH,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  normalizeTags,
  normalizeText,
} from "@/lib/interview/validation"
import { limitMessage, MAX_INTERVIEW_CHARS, tooLong } from "./limits"
import { fitRecord, notFound, PRIVATE_TEXT_NOTE, recordProfileEvent } from "./private-data"
import { iso, NOT_FOUND, type ToolOutcome } from "./tools"

/**
 * interview:read and profile:write tools for the interview workspace: the story bank, the "about me" facts and the
 * owner's saved prep and answers. Like every MCP tool, each query is bound to the token owner's userId. Nothing here
 * generates an answer or spends AI credits, and nothing deletes.
 */

type Page = { limit: number; offset: number }

// ── Reads (interview:read) ──────────────────────────────────────────────────────────────────────────────────────

/** Titles and tags only (the story text is in get_story), newest edit first. */
export async function listStories(userId: string, { limit, offset }: Page): Promise<ToolOutcome> {
  const [rows, [total]] = await Promise.all([
    db
      .select({ id: storyBank.id, title: storyBank.title, tags: storyBank.tags, sourceType: storyBank.sourceType, confirmedAt: storyBank.confirmedAt, updatedAt: storyBank.updatedAt })
      .from(storyBank)
      .where(eq(storyBank.userId, userId))
      .orderBy(desc(storyBank.updatedAt), desc(storyBank.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(storyBank).where(eq(storyBank.userId, userId)),
  ])
  const all = total?.total ?? 0
  return {
    data: {
      total: all,
      offset,
      count: rows.length,
      has_more: offset + rows.length < all,
      stories: rows.map((row) => ({ id: row.id, title: row.title, tags: row.tags ?? [], source: row.sourceType, confirmed: row.confirmedAt !== null, updated_at: iso(row.updatedAt) })),
      note: PRIVATE_TEXT_NOTE,
    },
  }
}

const storyColumns = {
  id: storyBank.id,
  title: storyBank.title,
  situation: storyBank.situation,
  task: storyBank.task,
  action: storyBank.action,
  result: storyBank.result,
  tags: storyBank.tags,
  sourceType: storyBank.sourceType,
  confirmedAt: storyBank.confirmedAt,
  updatedAt: storyBank.updatedAt,
}
type StoryRow = { id: string; title: string; situation: string | null; task: string | null; action: string | null; result: string | null; tags: string[] | null; sourceType: string; confirmedAt: Date | null; updatedAt: Date | null }

const storyView = (row: StoryRow) => ({
  id: row.id,
  title: row.title,
  situation: row.situation,
  task: row.task,
  action: row.action,
  result: row.result,
  tags: row.tags ?? [],
  source: row.sourceType,
  confirmed: row.confirmedAt !== null,
  updated_at: iso(row.updatedAt),
})

export async function getStory(userId: string, storyId: string): Promise<ToolOutcome> {
  const [row] = await db.select(storyColumns).from(storyBank).where(and(eq(storyBank.id, storyId), eq(storyBank.userId, userId))).limit(1)
  if (!row) return notFound("Story")
  const fit = fitRecord(storyView(row), MAX_INTERVIEW_CHARS)
  return { data: { ...fit.value, truncated: fit.truncated, total_characters: fit.total_characters, note: PRIVATE_TEXT_NOTE } }
}

/** The "about me" facts the interview workspace uses as evidence. Source references and file ids are internal and left out. */
export async function getInterviewProfileFacts(userId: string, { limit, offset }: Page, category?: string): Promise<ToolOutcome> {
  const where = and(eq(interviewProfileFacts.userId, userId), category ? eq(interviewProfileFacts.category, category) : undefined)
  const [rows, [total]] = await Promise.all([
    db
      .select({ id: interviewProfileFacts.id, category: interviewProfileFacts.category, label: interviewProfileFacts.label, detail: interviewProfileFacts.detail, sourceType: interviewProfileFacts.sourceType, confirmedAt: interviewProfileFacts.confirmedAt, updatedAt: interviewProfileFacts.updatedAt })
      .from(interviewProfileFacts)
      .where(where)
      .orderBy(desc(interviewProfileFacts.updatedAt), desc(interviewProfileFacts.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(interviewProfileFacts).where(where),
  ])
  const all = total?.total ?? 0
  const fit = fitRecord({ facts: rows.map((row) => ({ id: row.id, category: row.category, label: row.label, detail: row.detail, source: row.sourceType, confirmed: row.confirmedAt !== null, updated_at: iso(row.updatedAt) })) }, MAX_INTERVIEW_CHARS)
  return {
    data: { total: all, offset, count: (fit.value.facts as unknown[]).length, has_more: offset + rows.length < all, ...fit.value, truncated: fit.truncated, total_characters: fit.total_characters, ...(fit.omitted.length ? { omitted: fit.omitted } : {}), note: PRIVATE_TEXT_NOTE },
  }
}

/**
 * Saved interview prep. With an application: the prep JobClock generated for it (its questions and suggested answers; the
 * company research is get_company_research) and the owner's saved answers to that application's questions. Without one: the
 * owner's general practice questions and saved answers. Drafts are not included.
 */
export async function getInterviewPrep(userId: string, applicationId?: string): Promise<ToolOutcome> {
  const scope = applicationId ?? null
  let prep: { content: string | null; questions: string[]; suggested: Record<string, string>; savedAt: string | null } | null = null
  if (scope) {
    // interview_prep has no owner column: the join to the owner's application is what scopes it.
    const [row] = await db
      .select({ id: applications.id, questions: interviewPrep.questions, suggestedAnswers: interviewPrep.suggestedAnswers, savedAt: interviewPrep.createdAt })
      .from(applications)
      .leftJoin(interviewPrep, eq(interviewPrep.applicationId, applications.id))
      .where(and(eq(applications.id, scope), eq(applications.userId, userId)))
      .limit(1)
    if (!row) return NOT_FOUND
    const saved = row.suggestedAnswers as { raw?: string; answers?: Record<string, string> } | null
    if (row.questions || saved) prep = { content: saved?.raw ?? null, questions: row.questions ?? [], suggested: saved?.answers ?? {}, savedAt: iso(row.savedAt) }
  }

  const [questions, answers] = await Promise.all([
    db
      .select({ id: interviewQuestions.id, text: interviewQuestions.text, category: interviewQuestions.category, sourceType: interviewQuestions.sourceType })
      .from(interviewQuestions)
      .where(and(eq(interviewQuestions.userId, userId), scope ? eq(interviewQuestions.applicationId, scope) : isNull(interviewQuestions.applicationId)))
      .orderBy(desc(interviewQuestions.updatedAt), desc(interviewQuestions.id)),
    db
      .select({ questionId: interviewAnswers.questionId, content: interviewAnswers.content, updatedAt: interviewAnswers.updatedAt })
      .from(interviewAnswers)
      .where(and(eq(interviewAnswers.userId, userId), eq(interviewAnswers.status, "saved"), scope ? eq(interviewAnswers.applicationId, scope) : isNull(interviewAnswers.applicationId))),
  ])
  const answerFor = new Map(answers.map((answer) => [answer.questionId, answer]))
  const fit = fitRecord({
    ...(prep ? { prep_content: prep.content, prep_questions: prep.questions, prep_suggested_answers: prep.suggested } : {}),
    practice: questions.map((question) => ({
      question: question.text,
      category: question.category,
      saved_answer: answerFor.has(question.id) ? { content: answerFor.get(question.id)!.content, updated_at: iso(answerFor.get(question.id)!.updatedAt) } : null,
    })),
  }, MAX_INTERVIEW_CHARS)
  return {
    data: {
      application_id: scope,
      has_prep: prep !== null,
      ...(prep?.savedAt ? { prep_saved_at: prep.savedAt } : {}),
      ...fit.value,
      truncated: fit.truncated,
      total_characters: fit.total_characters,
      ...(fit.omitted.length ? { omitted: fit.omitted } : {}),
      note: `The prep and suggested answers are generated text, the saved answers are the owner's own. ${PRIVATE_TEXT_NOTE}`,
    },
  }
}

// ── Writes (profile:write) ──────────────────────────────────────────────────────────────────────────────────────

type Checked<T> = { value: T; error?: never } | { error: string; value?: never }

/** The interview workspace's own validation, with the limit named in the message an agent sees. */
function text(label: string, value: unknown, max: number, required: boolean): Checked<string> {
  if (typeof value === "string" && value.trim().length > max) return { error: tooLong(label, max) }
  const result = normalizeText(label, value, max, { required })
  return result.error === undefined ? { value: result.value } : { error: result.error }
}

function tags(value: unknown): Checked<string[]> {
  const result = normalizeTags(value)
  return result.error === undefined
    ? { value: result.value }
    : { error: limitMessage(`tags are invalid: at most ${MAX_TAGS} different, non-empty tags of ${MAX_TAG_LENGTH} characters each`, "These are the story bank's own limits in the web app.") }
}

export interface StoryInput { title?: string; situation?: string; task?: string; action?: string; result?: string; tags?: string[] }
const STORY_TEXT_FIELDS = ["situation", "task", "action", "result"] as const

/** What an audit event records about a story edit: which fields, and how long, never the text. */
const lengths = (values: object) =>
  Object.fromEntries(Object.entries(values).filter(([, value]) => typeof value === "string" || Array.isArray(value)).map(([field, value]) => [field, (value as string | unknown[]).length]))

function parseStory(input: StoryInput, requireTitle: boolean): Checked<Partial<Record<(typeof STORY_TEXT_FIELDS)[number] | "title", string>> & { tags?: string[] }> {
  const out: Partial<Record<(typeof STORY_TEXT_FIELDS)[number] | "title", string>> & { tags?: string[] } = {}
  if (requireTitle || input.title !== undefined) {
    const title = text("title", input.title, MAX_STORY_TITLE_LENGTH, true)
    if (title.error !== undefined) return title
    out.title = title.value
  }
  for (const field of STORY_TEXT_FIELDS) {
    if (input[field] === undefined) continue
    const parsed = text(field, input[field], MAX_STORY_FIELD_LENGTH, false)
    if (parsed.error !== undefined) return parsed
    out[field] = parsed.value
  }
  if (input.tags !== undefined) {
    const parsed = tags(input.tags)
    if (parsed.error !== undefined) return parsed
    out.tags = parsed.value
  }
  return { value: out }
}

export async function addStory(userId: string, input: StoryInput): Promise<ToolOutcome> {
  const parsed = parseStory(input, true)
  if (parsed.error !== undefined) return { error: parsed.error }
  const story = parsed.value
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(storyBank)
      .values({
        userId,
        title: story.title!,
        situation: story.situation || null,
        task: story.task || null,
        action: story.action || null,
        result: story.result || null,
        tags: story.tags ?? [],
        sourceType: "manual",
        confirmedAt: new Date(),
      })
      .returning(storyColumns)
    await recordProfileEvent(tx, userId, "interview.story_added", { storyId: row.id, fields: Object.keys(story), lengths: lengths(story) })
    return { data: { changed: true, after: storyView(row), to_undo: "Not auto-undoable and there is no delete tool: the owner can remove it in the JobClock web app (Interview -> Story bank)." } }
  })
}

export async function updateStory(userId: string, storyId: string, input: StoryInput): Promise<ToolOutcome> {
  const parsed = parseStory(input, false)
  if (parsed.error !== undefined) return { error: parsed.error }
  const fields = Object.keys(parsed.value)
  if (fields.length === 0) return { error: "Provide at least one of title, situation, task, action, result or tags." }

  return db.transaction(async (tx) => {
    const [before] = await tx.select(storyColumns).from(storyBank).where(and(eq(storyBank.id, storyId), eq(storyBank.userId, userId))).for("update").limit(1)
    if (!before) return notFound("Story")
    const change = {
      ...(parsed.value.title !== undefined ? { title: parsed.value.title } : {}),
      ...Object.fromEntries(STORY_TEXT_FIELDS.filter((field) => parsed.value[field] !== undefined).map((field) => [field, parsed.value[field] || null])),
      ...(parsed.value.tags !== undefined ? { tags: parsed.value.tags } : {}),
    }
    const [after] = await tx.update(storyBank).set({ ...change, updatedAt: new Date() }).where(and(eq(storyBank.id, storyId), eq(storyBank.userId, userId))).returning(storyColumns)
    await recordProfileEvent(tx, userId, "interview.story_updated", { storyId, fields, lengths: lengths(parsed.value) })
    const pick = (row: StoryRow) => Object.fromEntries(fields.map((field) => [field, storyView(row)[field as keyof ReturnType<typeof storyView>]]))
    return { data: { id: storyId, changed: true, before: pick(before), after: pick(after), to_undo: "Not auto-undoable. Call update_story again with the before values." } }
  })
}

export interface FactInput { category?: string; label?: string; detail?: string }

function parseFact(input: FactInput, requireAll: boolean): Checked<FactInput> {
  const out: FactInput = {}
  if (requireAll || input.category !== undefined) {
    if (!isAllowedFactCategory(input.category)) return { error: "category is invalid. Use one of the values listed in the tool description." }
    out.category = input.category.trim()
  }
  if (requireAll || input.label !== undefined) {
    const label = text("label", input.label, MAX_FACT_LABEL_LENGTH, true)
    if (label.error !== undefined) return label
    out.label = label.value
  }
  if (requireAll || input.detail !== undefined) {
    const detail = text("detail", input.detail, MAX_FACT_DETAIL_LENGTH, true)
    if (detail.error !== undefined) return detail
    out.detail = detail.value
  }
  return { value: out }
}

const factColumns = { id: interviewProfileFacts.id, category: interviewProfileFacts.category, label: interviewProfileFacts.label, detail: interviewProfileFacts.detail }

/** A new "about me" fact, saved as manual and confirmed like the interview workspace's own form. A manual fact with the same category and label is reported instead of duplicated. */
export async function addInterviewProfileFact(userId: string, input: FactInput): Promise<ToolOutcome> {
  const parsed = parseFact(input, true)
  if (parsed.error !== undefined) return { error: parsed.error }
  const fact = parsed.value as Required<FactInput>
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: interviewProfileFacts.id })
      .from(interviewProfileFacts)
      .where(and(eq(interviewProfileFacts.userId, userId), eq(interviewProfileFacts.sourceType, "manual"), eq(interviewProfileFacts.category, fact.category), sql`lower(${interviewProfileFacts.label}) = lower(${fact.label})`))
      .limit(1)
    if (existing) return { data: { created: false, duplicate: true, id: existing.id, hint: "A manual fact with this category and label already exists. Call update_interview_profile_fact with this id to change it." } }
    const [row] = await tx
      .insert(interviewProfileFacts)
      .values({ userId, category: fact.category, label: fact.label, detail: fact.detail, sourceType: "manual", confirmedAt: new Date() })
      .returning(factColumns)
    await recordProfileEvent(tx, userId, "interview.fact_added", { factId: row.id, category: fact.category, lengths: lengths(fact) })
    return { data: { created: true, after: row, to_undo: "Not auto-undoable and there is no delete tool: the owner can remove it in the JobClock web app (Interview -> About me)." } }
  })
}

export async function updateInterviewProfileFact(userId: string, factId: string, input: FactInput): Promise<ToolOutcome> {
  const parsed = parseFact(input, false)
  if (parsed.error !== undefined) return { error: parsed.error }
  const fields = Object.keys(parsed.value)
  if (fields.length === 0) return { error: "Provide at least one of category, label or detail." }

  return db.transaction(async (tx) => {
    const [before] = await tx.select(factColumns).from(interviewProfileFacts).where(and(eq(interviewProfileFacts.id, factId), eq(interviewProfileFacts.userId, userId))).for("update").limit(1)
    if (!before) return notFound("Fact")
    const [after] = await tx.update(interviewProfileFacts).set({ ...parsed.value, updatedAt: new Date() }).where(and(eq(interviewProfileFacts.id, factId), eq(interviewProfileFacts.userId, userId))).returning(factColumns)
    await recordProfileEvent(tx, userId, "interview.fact_updated", { factId, fields, lengths: lengths(parsed.value) })
    const pick = (row: typeof before) => Object.fromEntries(fields.map((field) => [field, row[field as keyof typeof row]]))
    return { data: { id: factId, changed: true, before: pick(before), after: pick(after), to_undo: "Not auto-undoable. Call update_interview_profile_fact again with the before values." } }
  })
}
