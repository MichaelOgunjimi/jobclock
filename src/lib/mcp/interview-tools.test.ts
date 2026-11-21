import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", async () => ({ db: (await import("./fake-db")).fakeDb }))

import { expectAllQueriesScopedTo, recorded, resetFakeDb, row, type RecordedQuery } from "./fake-db"
import { MAX_INTERVIEW_CHARS } from "./limits"
import {
  addInterviewProfileFact,
  addStory,
  getInterviewPrep,
  getInterviewProfileFacts,
  getStory,
  listStories,
  updateInterviewProfileFact,
  updateStory,
} from "./interview-tools"
import { runAsConnection } from "./connection-context"

const OWNER = "11111111-1111-4111-8111-111111111111"
const INTRUDER = "22222222-2222-4222-8222-222222222222"
const APP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const STORY = "55555555-5555-4555-8555-555555555555"
const FACT = "66666666-6666-4666-8666-666666666666"
const NOW = new Date("2026-11-20T10:00:00.000Z")

const STORY_KEYS = ["id", "title", "situation", "task", "action", "result", "tags", "sourceType", "confirmedAt", "updatedAt"]
const story = (extra: Record<string, unknown> = {}) => row(STORY_KEYS, { id: STORY, title: "Led migration", situation: "Old system", task: "Move it", action: "Planned cutover", result: "Zero downtime", tags: ["leadership"], sourceType: "manual", confirmedAt: NOW, updatedAt: NOW, ...extra })
const FACT_KEYS = ["id", "category", "label", "detail", "sourceType", "confirmedAt", "updatedAt"]

const forOwner = (answer: (query: RecordedQuery) => unknown[][]) => (query: RecordedQuery) => (query.params.includes(OWNER) && !query.params.includes(INTRUDER) ? answer(query) : [])
const insertMetadata = (table: string) => JSON.parse(recorded.find((query) => query.sql.startsWith(`insert into "${table}"`))!.params.find((p) => typeof p === "string" && p.startsWith("{")) as string)
const statements = (pattern: RegExp) => recorded.filter((query) => pattern.test(query.sql))

beforeEach(() => resetFakeDb())

describe("list_stories and get_story", () => {
  it("lists titles and tags only, with the total and a way to page", async () => {
    resetFakeDb(forOwner(({ sql }) => (/count\(\*\)/.test(sql) ? [[10]] : [story().slice(0, 1).concat(["Led migration", ["leadership"], "manual", NOW, NOW])])))
    const outcome = await listStories(OWNER, { limit: 1, offset: 5 })
    expect(outcome).toMatchObject({ data: { total: 10, offset: 5, count: 1, has_more: true, stories: [{ id: STORY, title: "Led migration", tags: ["leadership"], source: "manual", confirmed: true }] } })
    expect(JSON.stringify(outcome)).not.toContain("Planned cutover")
    const select = statements(/select/)[0]
    expect(select.sql).toMatch(/limit \$\d+ offset \$\d+/)
    expectAllQueriesScopedTo(OWNER)
  })

  it("returns one story in full for the owner only", async () => {
    resetFakeDb(forOwner(() => [story()]))
    expect(await getStory(OWNER, STORY)).toMatchObject({ data: { id: STORY, situation: "Old system", action: "Planned cutover", result: "Zero downtime", tags: ["leadership"], truncated: false } })
    expectAllQueriesScopedTo(OWNER)
    expect(await getStory(INTRUDER, STORY)).toEqual({ error: "Story not found." })
  })

  it("never returns the source reference or anything internal", async () => {
    resetFakeDb(forOwner(() => [story()]))
    await getStory(OWNER, STORY)
    expect(recorded.map((query) => query.sql).join(" ")).not.toMatch(/source_ref|user_id" ,|created_at/)
  })
})

describe("get_interview_profile_facts", () => {
  const fact = (i: number, detail = "detail") => row(FACT_KEYS, { id: `fact-${i}`, category: "skill", label: `Skill ${i}`, detail, sourceType: "cv", confirmedAt: NOW, updatedAt: NOW })

  it("returns the about-me facts without source references or document ids", async () => {
    resetFakeDb(forOwner(({ sql }) => (/count\(\*\)/.test(sql) ? [[2]] : [fact(1), fact(2)])))
    const outcome = await getInterviewProfileFacts(OWNER, { limit: 20, offset: 0 })
    expect(outcome).toMatchObject({ data: { total: 2, count: 2, has_more: false, truncated: false, facts: [{ id: "fact-1", category: "skill", label: "Skill 1", detail: "detail", source: "cv", confirmed: true }, expect.anything()] } })
    expect(Object.keys((outcome as { data: { facts: object[] } }).data.facts[0]).sort()).toEqual(["category", "confirmed", "detail", "id", "label", "source", "updated_at"])
    expect(recorded.map((query) => query.sql).join(" ")).not.toMatch(/source_ref|source_document/)
    expectAllQueriesScopedTo(OWNER)
  })

  it("filters by category inside the owner's rows", async () => {
    resetFakeDb(forOwner(({ sql }) => (/count\(\*\)/.test(sql) ? [[0]] : [])))
    await getInterviewProfileFacts(OWNER, { limit: 20, offset: 0 }, "goals")
    expect(recorded[0].params).toContain("goals")
    expectAllQueriesScopedTo(OWNER)
  })

  it(`cuts the reply at ${MAX_INTERVIEW_CHARS.toLocaleString("en-GB")} characters by whole facts and flags it`, async () => {
    resetFakeDb(forOwner(({ sql }) => (/count\(\*\)/.test(sql) ? [[50]] : Array.from({ length: 50 }, (_, i) => fact(i, "d".repeat(5000))))))
    const outcome = await getInterviewProfileFacts(OWNER, { limit: 50, offset: 0 })
    if ("error" in outcome) throw new Error(outcome.error)
    expect(outcome.data).toMatchObject({ truncated: true, omitted: ["facts"] })
    expect(outcome.data.total_characters as number).toBeGreaterThan(MAX_INTERVIEW_CHARS)
    expect((outcome.data.facts as unknown[]).length).toBeLessThan(50)
    expect(outcome.data.count).toBe((outcome.data.facts as unknown[]).length)
    expect(JSON.stringify(outcome.data.facts).length).toBeLessThanOrEqual(MAX_INTERVIEW_CHARS)
  })
})

describe("get_interview_prep", () => {
  const seed = (prep: { questions?: string[] | null; suggestedAnswers?: unknown } | null) =>
    resetFakeDb(({ sql, params }) => {
      if (!params.includes(OWNER) || params.includes(INTRUDER)) return []
      if (/from "applications"/.test(sql)) return params.includes(APP) ? [row(["id", "questions", "suggestedAnswers", "savedAt"], { id: APP, questions: prep?.questions ?? null, suggestedAnswers: prep?.suggestedAnswers ?? null, savedAt: NOW })] : []
      if (/from "interview_questions"/.test(sql)) return [row(["id", "text", "category", "sourceType"], { id: "q1", text: "Tell me about yourself", category: "opening", sourceType: "custom" }), row(["id", "text", "category", "sourceType"], { id: "q2", text: "Why us?", category: "motivation", sourceType: "custom" })]
      if (/from "interview_answers"/.test(sql)) return [row(["questionId", "content", "updatedAt"], { questionId: "q1", content: "I build things", updatedAt: NOW })]
      return []
    })

  it("returns the saved prep and the owner's saved answers for one application, without the company research", async () => {
    seed({ questions: ["What is a closure?"], suggestedAnswers: { raw: "# Prep", answers: { "What is a closure?": "A function plus scope" } } })
    const outcome = await getInterviewPrep(OWNER, APP)
    expect(outcome).toMatchObject({
      data: {
        application_id: APP,
        has_prep: true,
        prep_content: "# Prep",
        prep_questions: ["What is a closure?"],
        prep_suggested_answers: { "What is a closure?": "A function plus scope" },
        practice: [{ question: "Tell me about yourself", saved_answer: { content: "I build things" } }, { question: "Why us?", saved_answer: null }],
        truncated: false,
      },
    })
    expect(recorded.map((query) => query.sql).join(" ")).not.toContain("research_content")
    expect(recorded.filter((query) => /from "interview_answers"/.test(query.sql))[0].params).toContain("saved")
    expectAllQueriesScopedTo(OWNER)
  })

  it("without an application it returns the general practice questions and saved answers", async () => {
    seed(null)
    const outcome = await getInterviewPrep(OWNER)
    expect(outcome).toMatchObject({ data: { application_id: null, has_prep: false, practice: [expect.anything(), expect.anything()] } })
    expect(recorded.filter((query) => /from "interview_questions"/.test(query.sql))[0].sql).toContain('"application_id" is null')
    expect(recorded.every((query) => !/from "applications"/.test(query.sql))).toBe(true)
  })

  it("another user's application is 'not found' and none of its questions or answers are queried", async () => {
    seed({ questions: ["secret"] })
    expect(await getInterviewPrep(INTRUDER, APP)).toEqual({ error: "Application not found." })
    expect(recorded.every((query) => /from "applications"/.test(query.sql))).toBe(true)
  })

  it("an application of nobody's is not found", async () => {
    seed(null)
    expect(await getInterviewPrep(OWNER, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")).toEqual({ error: "Application not found." })
  })

  it(`cuts long prep at ${MAX_INTERVIEW_CHARS.toLocaleString("en-GB")} characters and names what was cut`, async () => {
    seed({ questions: [], suggestedAnswers: { raw: "p".repeat(MAX_INTERVIEW_CHARS + 1000) } })
    const outcome = await getInterviewPrep(OWNER, APP)
    if ("error" in outcome) throw new Error(outcome.error)
    expect(outcome.data).toMatchObject({ truncated: true })
    expect(outcome.data.omitted).toContain("prep_content")
    expect(JSON.stringify({ ...outcome.data }).length).toBeLessThan(MAX_INTERVIEW_CHARS + 2000)
  })
})

describe("add_story and update_story", () => {
  it("adds a manual, confirmed story with the workspace's validation and logs field names and lengths only", async () => {
    resetFakeDb(forOwner(() => [story({ title: "Fixed prod" })]))
    const outcome = await runAsConnection({ kind: "oauth", id: "grant-1", dailyCreateCap: 100, dailyDeleteCap: 10, dailyCreditCap: 20 }, () => addStory(OWNER, { title: "  Fixed prod ", action: "Rolled back", tags: ["ops"] }))
    expect(outcome).toMatchObject({ data: { changed: true, after: { id: STORY } } })
    const insert = statements(/^insert into "story_bank"/)[0]
    expect(insert.params).toContain("Fixed prod")
    expect(insert.params).toContain("manual")
    expect(insert.params).toContain(OWNER)
    expect(insertMetadata("profile_audit_events")).toEqual({ source: "mcp", connectionKind: "oauth", connectionId: "grant-1", storyId: STORY, fields: ["title", "action", "tags"], lengths: { title: 10, action: 11, tags: 1 } })
    expect(JSON.stringify(recorded.filter((query) => /profile_audit_events/.test(query.sql)))).not.toMatch(/Fixed prod|Rolled back/)
    expectAllQueriesScopedTo(OWNER)
  })

  it.each([
    [{ title: "" }, /title is required/],
    [{ title: "x".repeat(201) }, /title is longer than the 200-character limit/],
    [{ title: "ok", situation: "x".repeat(5001) }, /situation is longer than the 5,000-character limit/],
    [{ title: "ok", tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }, /tags are invalid: at most 20/],
    [{ title: "ok", tags: ["a", "a"] }, /tags are invalid/],
    [{ title: "ok", tags: ["x".repeat(81)] }, /tags are invalid/],
  ])("refuses %j before writing anything", async (input, message) => {
    expect(await addStory(OWNER, input)).toEqual({ error: expect.stringMatching(message) })
    expect(recorded).toHaveLength(0)
  })

  it("updates only the fields sent and returns before and after of those fields", async () => {
    resetFakeDb(forOwner(({ sql }) => (/^update/.test(sql) ? [story({ action: "New plan", tags: ["ops"] })] : [story()])))
    const outcome = await updateStory(OWNER, STORY, { action: "New plan", tags: ["ops"] })
    expect(outcome).toMatchObject({ data: { changed: true, before: { action: "Planned cutover", tags: ["leadership"] }, after: { action: "New plan", tags: ["ops"] } } })
    expect(Object.keys((outcome as { data: { before: object } }).data.before).sort()).toEqual(["action", "tags"])
    const update = statements(/^update "story_bank"/)[0]
    const set = update.sql.slice(update.sql.indexOf(" set "), update.sql.indexOf(" where "))
    expect(set).not.toMatch(/"title"|"situation"|"task"|"result"/)
    expect(update.sql).toContain('"user_id" = $')
    expect(insertMetadata("profile_audit_events")).toMatchObject({ storyId: STORY, fields: ["action", "tags"], lengths: { action: 8, tags: 1 } })
    expect(JSON.stringify(recorded.filter((query) => /profile_audit_events/.test(query.sql)))).not.toContain("New plan")
    expectAllQueriesScopedTo(OWNER)
  })

  it("an empty string clears a text field, but the title can never be empty", async () => {
    resetFakeDb(forOwner(({ sql }) => (/^update/.test(sql) ? [story({ result: null })] : [story()])))
    expect(await updateStory(OWNER, STORY, { result: "" })).toMatchObject({ data: { after: { result: null } } })
    expect(statements(/^update "story_bank"/)[0].params).toContain(null)
    expect(await updateStory(OWNER, STORY, { title: " " })).toEqual({ error: "title is required" })
  })

  it("asking for nothing, or for somebody else's story, changes nothing", async () => {
    resetFakeDb(forOwner(() => [story()]))
    expect(await updateStory(OWNER, STORY, {})).toEqual({ error: expect.stringContaining("Provide at least one") })
    expect(await updateStory(INTRUDER, STORY, { title: "Mine now" })).toEqual({ error: "Story not found." })
    expect(statements(/^update|^insert/)).toHaveLength(0)
  })
})

describe("add_interview_profile_fact and update_interview_profile_fact", () => {
  const FACT_RETURN = ["id", "category", "label", "detail"]
  const fact = (extra: Record<string, unknown> = {}) => row(FACT_RETURN, { id: FACT, category: "goals", label: "Next role", detail: "Staff engineer", ...extra })

  it("adds a manual fact, confirmed, in the owner's name", async () => {
    resetFakeDb(forOwner(({ sql }) => (/^insert/.test(sql) ? [fact()] : [])))
    expect(await addInterviewProfileFact(OWNER, { category: "goals", label: " Next role ", detail: "Staff engineer" })).toMatchObject({ data: { created: true, after: { id: FACT, category: "goals" } } })
    const insert = statements(/^insert into "interview_profile_facts"/)[0]
    expect(insert.params).toEqual(expect.arrayContaining([OWNER, "goals", "Next role", "Staff engineer", "manual"]))
    expect(insertMetadata("profile_audit_events")).toMatchObject({ factId: FACT, category: "goals", lengths: { label: 9, detail: 14 } })
    expect(JSON.stringify(recorded.filter((query) => /profile_audit_events/.test(query.sql)))).not.toContain("Staff engineer")
    expectAllQueriesScopedTo(OWNER)
  })

  it("reports an existing manual fact with the same category and label instead of adding a duplicate", async () => {
    resetFakeDb(forOwner(() => [[FACT]]))
    expect(await addInterviewProfileFact(OWNER, { category: "goals", label: "Next role", detail: "x" })).toMatchObject({ data: { created: false, duplicate: true, id: FACT } })
    expect(statements(/^insert/)).toHaveLength(0)
  })

  it.each([
    [{ category: "secrets", label: "a", detail: "b" }, /category is invalid/],
    [{ category: "goals", label: "", detail: "b" }, /label is required/],
    [{ category: "goals", label: "x".repeat(201), detail: "b" }, /label is longer than the 200-character limit/],
    [{ category: "goals", label: "a", detail: "x".repeat(5001) }, /detail is longer than the 5,000-character limit/],
  ])("refuses %j before writing anything", async (input, message) => {
    expect(await addInterviewProfileFact(OWNER, input)).toEqual({ error: expect.stringMatching(message) })
    expect(recorded).toHaveLength(0)
  })

  it("updates a fact with before and after, scoped to the owner", async () => {
    resetFakeDb(forOwner(({ sql }) => (/^update/.test(sql) ? [fact({ detail: "Principal" })] : [fact()])))
    const outcome = await updateInterviewProfileFact(OWNER, FACT, { detail: "Principal" })
    expect(outcome).toMatchObject({ data: { changed: true, before: { detail: "Staff engineer" }, after: { detail: "Principal" } } })
    expect(statements(/^update "interview_profile_facts"/)[0].sql).toContain('"user_id" = $')
    expect(insertMetadata("profile_audit_events")).toMatchObject({ factId: FACT, fields: ["detail"], lengths: { detail: 9 } })
    expectAllQueriesScopedTo(OWNER)
  })

  it("never edits somebody else's fact", async () => {
    resetFakeDb(forOwner(() => [fact()]))
    expect(await updateInterviewProfileFact(INTRUDER, FACT, { detail: "x" })).toEqual({ error: "Fact not found." })
    expect(await updateInterviewProfileFact(OWNER, FACT, {})).toEqual({ error: expect.stringContaining("Provide at least one") })
    expect(statements(/^update|^insert/)).toHaveLength(0)
  })
})
