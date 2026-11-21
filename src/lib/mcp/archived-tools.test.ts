import { beforeEach, describe, expect, it, vi } from "vitest"

const { enqueueGeneration, persistJobForUser } = vi.hoisted(() => ({ enqueueGeneration: vi.fn(), persistJobForUser: vi.fn() }))
vi.mock("@/lib/db", async () => ({ db: (await import("./fake-db")).fakeDb }))
vi.mock("@/lib/generation/enqueue", () => ({ enqueueGeneration }))
vi.mock("@/lib/jobs/persist-job", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/jobs/persist-job")>()), persistJobForUser }))

import { recorded, resetFakeDb, row, type RecordedQuery } from "./fake-db"
import { getPipelineSummary, listStaleApplications, listUpcomingDeadlines, listUpcomingInterviews } from "./inbox-tools"
import { addApplication, checkJobExists } from "./job-tools"
import { getApplication, listApplications, listDue } from "./tools"

const OWNER = "11111111-1111-4111-8111-111111111111"
const NOW = new Date("2026-11-20T10:00:00.000Z")
const ARCHIVED_RULE = '"applications"."archived_at" is null'
const ARCHIVED_AT = new Date("2026-11-10T09:00:00.000Z")

beforeEach(() => {
  persistJobForUser.mockReset()
  resetFakeDb()
})

const applicationQueries = () => recorded.filter((query) => /from "applications"/.test(query.sql))

describe("archived applications are hidden from lists, summaries and reminders", () => {
  it.each([
    ["get_pipeline_summary", () => getPipelineSummary(OWNER, NOW)],
    ["list_due", () => listDue(OWNER, 7, NOW)],
    ["list_stale_applications", () => listStaleApplications(OWNER, 10, NOW)],
    ["list_upcoming_deadlines", () => listUpcomingDeadlines(OWNER, NOW)],
    ["list_upcoming_interviews", () => listUpcomingInterviews(OWNER, 7, NOW)],
  ])("%s: every query over applications filters archived rows", async (_name, run) => {
    await run()
    const queries = applicationQueries()
    expect(queries.length).toBeGreaterThan(0)
    for (const query of queries) expect(query.sql).toContain(ARCHIVED_RULE)
  })

  it("list_applications leaves archived rows out by default", async () => {
    await listApplications(OWNER, { limit: 10 })
    expect(recorded[0].sql).toContain(ARCHIVED_RULE)
  })

  it("list_applications with an overdue filter still leaves archived rows out by default", async () => {
    await listApplications(OWNER, { limit: 10, overdueFollowUps: true })
    expect(recorded[0].sql).toContain(ARCHIVED_RULE)
  })

  it("include_archived lists both and says which row is archived", async () => {
    resetFakeDb(() => [])
    await listApplications(OWNER, { limit: 10, includeArchived: true })
    expect(recorded[0].sql).not.toContain("archived_at\" is null")
    expect(recorded[0].sql).not.toContain("archived_at\" is not null")
    expect(recorded[0].sql).toContain('"applications"."archived_at"') // selected, so each row shows archived and archived_at
  })

  it("archived_only lists only archived rows", async () => {
    await listApplications(OWNER, { limit: 10, archivedOnly: true })
    expect(recorded[0].sql).toContain('"applications"."archived_at" is not null')
    expect(recorded[0].sql).not.toContain(ARCHIVED_RULE)
  })

  it("archived_only wins over include_archived: true, but contradicts include_archived: false", async () => {
    await listApplications(OWNER, { limit: 10, archivedOnly: true, includeArchived: true })
    expect(recorded[0].sql).toContain('is not null')
    recorded.length = 0
    const result = await listApplications(OWNER, { limit: 10, archivedOnly: true, includeArchived: false })
    expect(result).toEqual({ error: expect.stringMatching(/contradict/) })
    expect(recorded).toHaveLength(0)
  })

  it("list rows carry archived and archived_at when archived rows can appear", async () => {
    const keys = ["id", "slug", "status", "appliedAt", "lastStatusUpdate", "followUpDueAt", "interviewAt", "customTitle", "customCompany", "jobTitle", "jobCompany", "archivedAt"]
    resetFakeDb(() => [
      row(keys, { id: "a", slug: "s", status: "saved", customTitle: "Old", archivedAt: ARCHIVED_AT }),
      row(keys, { id: "b", slug: "t", status: "saved", customTitle: "Live" }),
    ])
    const result = await listApplications(OWNER, { limit: 10, includeArchived: true })
    expect(result).toEqual({ data: { count: 2, applications: [
      expect.objectContaining({ id: "a", archived: true, archived_at: ARCHIVED_AT.toISOString() }),
      expect.objectContaining({ id: "b", archived: false, archived_at: null }),
    ] } })
  })
})

describe("get_application works on archived rows", () => {
  it("shows archived_at and tags", async () => {
    const keys = ["id", "slug", "status", "appliedAt", "lastStatusUpdate", "followUpDueAt", "interviewAt", "customTitle", "customCompany", "jobTitle", "jobCompany", "archivedAt", "tags", "notes", "followUpNotes", "followUpCount", "source", "postingUrl"]
    resetFakeDb(({ sql }: RecordedQuery) => (/from "applications"/.test(sql) && !/status_events|audit/.test(sql) ? [row(keys, { id: "a", slug: "s", status: "applied", customTitle: "Old", archivedAt: ARCHIVED_AT, tags: ["remote", "dream"] })] : []))
    const result = await getApplication(OWNER, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    expect(result).toEqual({ data: expect.objectContaining({ archived: true, archived_at: ARCHIVED_AT.toISOString(), tags: ["remote", "dream"] }) })
    expect(recorded[0].sql).not.toContain("archived_at\" is null") // not filtered out
  })
})

describe("archived applications are still found, so a finder does not add them again", () => {
  const MATCH_KEYS = ["id", "slug", "status", "createdAt", "customTitle", "customCompany", "jobTitle", "jobCompany", "url", "archivedAt"]
  const archivedMatch = () => row(MATCH_KEYS, { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", slug: "s", status: "rejected", createdAt: new Date("2026-10-01"), jobTitle: "Platform Engineer", jobCompany: "Acme", url: "https://jobs.example.com/view/123", archivedAt: ARCHIVED_AT })
  const seed = () => resetFakeDb(({ sql }: RecordedQuery) => (/^select .* from "applications"/.test(sql) ? [archivedMatch()] : []))

  it("check_job_exists returns the archived match with archived: true and a note", async () => {
    seed()
    const result = await checkJobExists(OWNER, { url: "https://jobs.example.com/view/123" })
    expect(result).toEqual({ data: expect.objectContaining({ exists: true, url_matches: [expect.objectContaining({ archived: true, status: "rejected" })], note: expect.stringMatching(/archived/) }) })
    for (const query of recorded) expect(query.sql).not.toContain(ARCHIVED_RULE)
  })

  it("check_job_exists finds an archived company and title match too", async () => {
    seed()
    const result = await checkJobExists(OWNER, { company: "Acme", title: "Platform Engineer" })
    expect(result).toEqual({ data: expect.objectContaining({ exists: false, same_company_and_title: [expect.objectContaining({ archived: true })] }) })
  })

  it("add_application with an archived application's URL returns it as a duplicate and does not restore or create", async () => {
    seed()
    const result = await addApplication(OWNER, { url: "https://jobs.example.com/view/123", title: "Platform Engineer", company: "Acme" }, NOW)
    expect(result).toEqual({ data: expect.objectContaining({ created: false, duplicate: "url", existing: expect.objectContaining({ archived: true }), hint: expect.stringMatching(/archived/) }) })
    expect(persistJobForUser).not.toHaveBeenCalled()
    expect(recorded.filter((query) => /^(insert|update|delete)/i.test(query.sql))).toHaveLength(0)
  })

  it("add_application with an archived company and title match is a duplicate that says it is archived", async () => {
    resetFakeDb(({ sql }: RecordedQuery) => {
      if (/count\(\*\)/.test(sql)) return [[0]]
      if (/inner join "jobs_cache"/.test(sql)) return []
      return /lower\(trim\(coalesce/.test(sql) ? [archivedMatch()] : []
    })
    const result = await addApplication(OWNER, { url: "https://jobs.example.com/view/999", title: "Platform Engineer", company: "Acme" }, NOW)
    expect(result).toEqual({ data: expect.objectContaining({ created: false, duplicate: "company_and_title", existing: expect.objectContaining({ archived: true }), hint: expect.stringMatching(/archived/) }) })
    expect(persistJobForUser).not.toHaveBeenCalled()
  })
})
