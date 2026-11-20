import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", async () => ({ db: (await import("./fake-db")).fakeDb }))

import { aiUsagePeriods, applications } from "@/lib/db/schema"
import { STALE_AFTER_DAYS } from "@/lib/applications/attention"
import { expectAllQueriesScopedTo, recorded, resetFakeDb, row, tableRow, type RecordedQuery } from "./fake-db"
import {
  completeFollowUp,
  getApplicationActivity,
  getCompanyResearch,
  getCredits,
  getPipelineSummary,
  listCvs,
  listStaleApplications,
  listUpcomingDeadlines,
  listUpcomingInterviews,
  MAX_RESEARCH_CHARS,
  snoozeFollowUp,
  undoLastChange,
  updateApplicationDetails,
  updateApplicationStatuses,
} from "./inbox-tools"

const OWNER = "11111111-1111-4111-8111-111111111111"
const INTRUDER = "22222222-2222-4222-8222-222222222222"
const APP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const APP2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const NOW = new Date("2026-11-20T10:00:00.000Z")
const DAY = 86_400_000

const SUMMARY_KEYS = ["id", "slug", "status", "appliedAt", "lastStatusUpdate", "followUpDueAt", "interviewAt", "customTitle", "customCompany", "jobTitle", "jobCompany"]
const DETAIL_KEYS = [...SUMMARY_KEYS, "notes", "followUpNotes", "followUpCount", "source", "postingUrl"]

type AuditEvent = { id: string; eventType: string; metadata: Record<string, unknown>; createdAt: Date }
const state = {
  app: {} as Record<string, unknown>,
  events: [] as AuditEvent[],
  research: null as string | null,
}

const freshApp = () => ({
  id: APP,
  slug: "engineer-acme",
  userId: OWNER,
  status: "applied",
  appliedAt: null,
  lastStatusUpdate: new Date(NOW.getTime() - 30 * DAY),
  followUpDueAt: new Date("2026-11-18T09:00:00.000Z"),
  followUpNotes: "chase recruiter",
  followUpCount: 2,
  interviewAt: null,
  customTitle: "Engineer",
  customCompany: "Acme",
  customLocation: null,
  customSalaryText: null,
  notes: null,
})

/** Rows are only returned to a query bound to the owner's id, like the user_id condition does in the database. */
function seed() {
  resetFakeDb(({ sql, params }: RecordedQuery) => {
    if (/^update "applications"/.test(sql) && params.includes(OWNER) && !params.includes(APP2)) {
      const set = sql.slice(sql.indexOf(" set ") + 5, sql.indexOf(" where "))
      const columns = set.split(", ").map((part) => part.split(" = ")[0].replaceAll('"', ""))
      const camel = (column: string) => column.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())
      columns.forEach((column, index) => { state.app[camel(column)] = params[index] })
      return []
    }
    if (/^(insert|update|delete)/i.test(sql) || !params.includes(OWNER) || params.includes(APP2)) return [] // APP2 is not the owner's
    if (/from "application_audit_events"/.test(sql)) return state.events.map((event) => [event.id, event.eventType, event.metadata, event.createdAt])
    if (/from "interview_prep"|join "interview_prep"/.test(sql)) return [[state.research, NOW]]
    if (/from "user_cvs"/.test(sql)) return [["cv-1", "Main CV", true, NOW], ["cv-2", null, false, NOW]]
    if (/from "ai_usage_periods"/.test(sql)) {
      return [tableRow(aiUsagePeriods, { userId: OWNER, periodStart: new Date("2026-11-01T00:00:00Z"), periodEnd: new Date("2026-12-01T00:00:00Z"), creditLimit: 300, creditsReserved: 10, creditsUsed: 250 })]
    }
    if (/from "billing_subscriptions"/.test(sql)) return []
    if (/from "ai_credit_balances"/.test(sql)) return [[40]]
    if (/count\(\*\) filter/.test(sql)) return [[2, 1]]
    if (/group by/.test(sql)) return [["saved", 2], ["applied", 3], ["screening", 1], ["rejected", 1]]
    if (/select count\(\*\)/.test(sql)) return [[/apply_deadline/.test(sql) ? 4 : /interview_at/.test(sql) ? 3 : /last_status_update/.test(sql) ? 2 : 5]]
    if (/^select "id", "status", "applied_at"/.test(sql)) return [[APP, state.app.status, null]]
    if (/for update/.test(sql)) return [tableRow(applications, state.app)]
    if (/from "applications"/.test(sql)) {
      const keys = /"apply_deadline"/.test(sql) ? [...SUMMARY_KEYS, "deadline"] : /"follow_up_notes"/.test(sql) ? DETAIL_KEYS : SUMMARY_KEYS
      return [row(keys, { ...state.app, deadline: "2026-11-22" })]
    }
    return []
  })
}

const writes = () => recorded.filter((query) => /^(insert|update|delete)/i.test(query.sql))
const auditInserts = () => writes().filter((query) => /into "application_audit_events"/.test(query.sql))

beforeEach(() => {
  state.app = freshApp()
  state.events = []
  state.research = null
  seed()
})

const mcpEvent = (id: string, eventType: string, changes: Record<string, unknown>, minutesAgo = 5, extra: Record<string, unknown> = {}): AuditEvent => ({
  id,
  eventType,
  metadata: { source: "mcp", changes, ...extra },
  createdAt: new Date(NOW.getTime() - minutesAgo * 60_000),
})

describe("every new tool is scoped to the token owner's user_id", () => {
  const calls: [string, (userId: string) => Promise<unknown>][] = [
    ["get_pipeline_summary", (u) => getPipelineSummary(u, NOW)],
    ["list_stale_applications", (u) => listStaleApplications(u, 20, NOW)],
    ["list_upcoming_deadlines", (u) => listUpcomingDeadlines(u, NOW)],
    ["list_upcoming_interviews", (u) => listUpcomingInterviews(u, 7, NOW)],
    ["get_application_activity", (u) => getApplicationActivity(u, APP, 20)],
    ["get_company_research", (u) => getCompanyResearch(u, APP)],
    ["get_credits", (u) => getCredits(u, NOW)],
    ["list_cvs", (u) => listCvs(u)],
    ["update_application_statuses", (u) => updateApplicationStatuses(u, [{ applicationId: APP, status: "screening", intent: "progress" }])],
    ["snooze_follow_up", (u) => snoozeFollowUp(u, APP, { days: 3 }, NOW)],
    ["complete_follow_up", (u) => completeFollowUp(u, APP)],
    ["update_application_details", (u) => updateApplicationDetails(u, APP, { title: "Staff Engineer" })],
    ["undo_last_change", (u) => undoLastChange(u, APP)],
  ]

  beforeEach(() => {
    state.research = "Acme builds anvils."
    state.events = [mcpEvent("e1", "application.follow_up_updated", { followUpDueAt: { before: null, after: "2026-11-18T09:00:00.000Z" } })]
  })

  it.each(calls)("%s binds every query to the owner and only the owner", async (_name, call) => {
    await call(OWNER)
    expectAllQueriesScopedTo(OWNER, [INTRUDER])
  })

  it.each(calls)("%s with another user's token sees nothing and writes nothing", async (_name, call) => {
    const result = JSON.stringify(await call(INTRUDER))
    expectAllQueriesScopedTo(INTRUDER, [OWNER])
    expect(writes()).toHaveLength(0)
    for (const secret of ["Acme", "Engineer", "Main CV", "anvils", "chase recruiter"]) expect(result).not.toContain(secret)
  })
})

describe("get_pipeline_summary", () => {
  it("reuses the digest's stats and response rate, and adds what needs attention", async () => {
    const result = await getPipelineSummary(OWNER, NOW)
    expect(result).toEqual({
      data: {
        as_of: NOW.toISOString(),
        total: 7,
        by_status: { saved: 2, applied: 3, screening: 1, rejected: 1 },
        saved_this_week: 2,
        applied_this_week: 1,
        applications_sent: 5,
        replies: 2,
        response_rate_percent: 40,
        overdue_follow_ups: 5,
        interviews_next_7_days: 3,
        stale_applications: 2,
        saved_with_deadline_soon: 4,
      },
    })
  })
})

describe("stale and deadline definitions match the emails", () => {
  it("stale: applied or screening, no status change for 21 days (the shared constant the email uses)", async () => {
    const result = (await listStaleApplications(OWNER, 20, NOW)) as { data: { stale_after_days: number; applications: { days_since_update: number }[] } }
    const query = recorded[0]
    expect(query.sql).toMatch(/"status" in \(\$\d+, \$\d+\)/)
    expect(query.params).toEqual(expect.arrayContaining(["applied", "screening", new Date(NOW.getTime() - STALE_AFTER_DAYS * DAY).toISOString()]))
    expect(query.sql).toMatch(/order by "applications"\."last_status_update" asc/)
    expect(result.data.stale_after_days).toBe(21)
    expect(result.data.applications[0].days_since_update).toBe(30)
  })

  it("deadlines: saved jobs whose deadline is after today and at most two days away", async () => {
    const result = (await listUpcomingDeadlines(OWNER, NOW)) as { data: { applications: { apply_deadline: string; days_left: number }[] } }
    const query = recorded[0]
    expect(query.sql).toMatch(/inner join "jobs_cache"/)
    expect(query.sql).toMatch(/"apply_deadline" > \$\d+ and .*"apply_deadline" <= \$\d+/)
    expect(query.params).toEqual(expect.arrayContaining(["saved", "2026-11-20", "2026-11-22"]))
    expect(result.data.applications[0]).toMatchObject({ apply_deadline: "2026-11-22", days_left: 2 })
  })

  it("interviews: the next N days, open statuses, soonest first", async () => {
    await listUpcomingInterviews(OWNER, 1, NOW)
    expect(recorded[0].params).toEqual(expect.arrayContaining([NOW.toISOString(), new Date(NOW.getTime() + DAY).toISOString(), "saved", "applied", "screening", "interview", "offer"]))
    expect(recorded[0].sql).toMatch(/order by "applications"\."interview_at" asc/)
  })
})

describe("read-only lookups", () => {
  it("get_application_activity returns who made each change and never note text", async () => {
    state.events = [
      mcpEvent("e2", "application.notes_updated", { notes: { before: { present: false, characters: 0 }, after: { present: true, characters: 40 } } }, 1),
      { id: "e1", eventType: "application.created", metadata: {}, createdAt: new Date(NOW.getTime() - DAY) },
    ]
    const result = (await getApplicationActivity(OWNER, APP, 20)) as { data: { events: { event_id: string; source: string; details: object }[] } }
    expect(result.data.events.map((event) => [event.event_id, event.source])).toEqual([["e2", "mcp"], ["e1", "web"]])
    expect(JSON.stringify(result.data.events[0].details)).toContain('"characters":40')
  })

  it("get_company_research returns saved research, truncates, and never generates", async () => {
    expect(await getCompanyResearch(OWNER, APP)).toEqual({ data: { id: APP, has_research: false } })
    state.research = "x".repeat(MAX_RESEARCH_CHARS + 5)
    const result = (await getCompanyResearch(OWNER, APP)) as { data: { content: string; truncated: boolean; total_characters: number } }
    expect(result.data.content).toHaveLength(MAX_RESEARCH_CHARS)
    expect(result.data).toMatchObject({ truncated: true, total_characters: MAX_RESEARCH_CHARS + 5 })
    expect(writes()).toHaveLength(0)
  })

  it("get_credits reports the current allowance (as the credits email computes it) plus purchased credits", async () => {
    expect(await getCredits(OWNER, NOW)).toEqual({
      data: {
        monthly_allowance: { limit: 300, used: 250, reserved: 10, resets_at: "2026-12-01T00:00:00.000Z", remaining: 40 },
        purchased_credits: 40,
        total_remaining: 80,
      },
    })
  })

  it("list_cvs returns ids, names and primary flag only", async () => {
    const result = await listCvs(OWNER)
    expect(result).toEqual({
      data: {
        count: 2,
        cvs: [
          { id: "cv-1", name: "Main CV", is_primary: true, created_at: NOW.toISOString() },
          { id: "cv-2", name: "Untitled CV", is_primary: false, created_at: NOW.toISOString() },
        ],
      },
    })
    expect(recorded[0].sql).not.toMatch(/parsed_json|file_path|review_findings/)
  })
})

describe("update_application_statuses", () => {
  it("returns a result per item; a failing item does not stop the others", async () => {
    const result = (await updateApplicationStatuses(OWNER, [
      { applicationId: APP, status: "rejected", intent: "progress" },
      { applicationId: APP2, status: "rejected", intent: "progress" }, // another application the owner does not have
      { applicationId: APP, status: "saved", intent: "progress" }, // a backwards move without correction intent
    ])) as { data: { succeeded: number; failed: number; results: Record<string, unknown>[] } }
    expect(result.data).toMatchObject({ succeeded: 1, failed: 2 })
    expect(result.data.results[0]).toMatchObject({ application_id: APP, ok: true, changed: true, before: { status: "applied" } })
    expect(result.data.results[2]).toMatchObject({ application_id: APP, ok: false, error: expect.stringContaining("Cannot move") })
    const inserts = auditInserts()
    expect(inserts).toHaveLength(1)
    expect(inserts[0].params).toContainEqual(expect.stringContaining('"source":"mcp"'))
  })
})

describe("snooze_follow_up and complete_follow_up", () => {
  it("snoozes from the current date when it is in the future", async () => {
    state.app.followUpDueAt = new Date("2026-11-25T09:00:00.000Z")
    const result = await snoozeFollowUp(OWNER, APP, { days: 3 }, NOW)
    expect(result).toEqual({
      data: expect.objectContaining({
        changed: true,
        before: { follow_up_due_at: "2026-11-25T09:00:00.000Z", follow_up_note: "chase recruiter" },
        after: { follow_up_due_at: "2026-11-28T09:00:00.000Z", follow_up_note: "chase recruiter" },
      }),
    })
    expect(JSON.stringify(auditInserts()[0].params)).toContain("application.follow_up_updated")
  })

  it("an overdue follow-up is snoozed from now, so it lands in the future", async () => {
    const result = (await snoozeFollowUp(OWNER, APP, { days: 2 }, NOW)) as { data: { after: { follow_up_due_at: string } } }
    expect(result.data.after.follow_up_due_at).toBe("2026-11-22T10:00:00.000Z")
  })

  it("snoozes to a date, and rejects bad input without touching anything", async () => {
    const until = await snoozeFollowUp(OWNER, APP, { until: "2026-12-01T09:00:00+00:00" }, NOW)
    expect(until).toEqual({ data: expect.objectContaining({ after: expect.objectContaining({ follow_up_due_at: "2026-12-01T09:00:00.000Z" }) }) })
    recorded.length = 0
    expect(await snoozeFollowUp(OWNER, APP, {}, NOW)).toEqual({ error: "Provide exactly one of days or until." })
    expect(await snoozeFollowUp(OWNER, APP, { days: 2, until: "2026-12-01T09:00:00+00:00" }, NOW)).toEqual({ error: "Provide exactly one of days or until." })
    expect(await snoozeFollowUp(OWNER, APP, { until: "2026-11-01T09:00:00+00:00" }, NOW)).toEqual({ error: "until must be in the future." })
    expect(await snoozeFollowUp(OWNER, APP, { days: 9999 }, NOW)).toEqual({ error: expect.stringContaining("1 to 365") })
    expect(recorded).toHaveLength(0)
  })

  it("complete_follow_up clears the date and note like the Clear button, and leaves follow_up_count alone", async () => {
    const result = await completeFollowUp(OWNER, APP)
    expect(result).toEqual({
      data: expect.objectContaining({
        changed: true,
        before: { follow_up_due_at: "2026-11-18T09:00:00.000Z", follow_up_note: "chase recruiter" },
        after: { follow_up_due_at: null, follow_up_note: null },
      }),
    })
    const update = writes().find((query) => /^update "applications"/.test(query.sql))!
    expect(update.sql).toMatch(/"follow_up_due_at"/)
    expect(update.sql).not.toMatch(/follow_up_count/)
  })

  it("complete_follow_up on an application with no follow-up changes nothing", async () => {
    state.app.followUpDueAt = null
    state.app.followUpNotes = null
    expect(await completeFollowUp(OWNER, APP)).toEqual({ data: expect.objectContaining({ changed: false }) })
    expect(writes()).toHaveLength(0)
  })
})

describe("update_application_details", () => {
  it("applies the web app's validation and records before/after", async () => {
    const result = await updateApplicationDetails(OWNER, APP, { title: "  Staff Engineer ", salary: "£70k" })
    expect(result).toEqual({
      data: { id: APP, changed: true, before: { title: "Engineer", salary: null }, after: { title: "Staff Engineer", salary: "£70k" } },
    })
    expect(JSON.stringify(auditInserts()[0].params)).toContain("application.details_updated")
  })

  it("rejects what the web form rejects, and an empty request", async () => {
    expect(await updateApplicationDetails(OWNER, APP, { title: "   " })).toEqual({ error: "title: Role is required" })
    expect(await updateApplicationDetails(OWNER, APP, { company: "x".repeat(201) })).toEqual({ error: expect.stringContaining("company:") })
    expect(await updateApplicationDetails(OWNER, APP, {})).toEqual({ error: expect.stringContaining("at least one") })
    expect(recorded).toHaveLength(0)
  })

  it("null goes back to the posting's own value", async () => {
    const result = await updateApplicationDetails(OWNER, APP, { company: null })
    expect(result).toEqual({ data: expect.objectContaining({ before: { company: "Acme" }, after: { company: null } }) })
  })
})

describe("undo_last_change", () => {
  const followUpEvent = (after: string | null, before: string | null = "2026-11-10T09:00:00.000Z") =>
    mcpEvent("e1", "application.follow_up_updated", { followUpDueAt: { before, after } })

  it("restores the recorded before value and tags the new event with what it undid", async () => {
    state.app.followUpDueAt = new Date("2026-11-18T09:00:00.000Z")
    state.events = [followUpEvent("2026-11-18T09:00:00.000Z")]
    const result = await undoLastChange(OWNER, APP)
    expect(result).toEqual({
      data: expect.objectContaining({
        changed: true,
        reverted_event: expect.objectContaining({ event_id: "e1", type: "application.follow_up_updated" }),
        reverted: { follow_up_due_at: { from: "2026-11-18T09:00:00.000Z", to: "2026-11-10T09:00:00.000Z" } },
      }),
    })
    const update = writes().find((query) => /^update "applications"/.test(query.sql))!
    expect(update.params).toContainEqual("2026-11-10T09:00:00.000Z")
    const audit = auditInserts()[0].params.join("")
    expect(audit).toContain('"source":"mcp"')
    expect(audit).toContain('"undoes":["e1"]')
  })

  it("restores text fields, and a cleared date", async () => {
    state.app.customTitle = "Staff Engineer"
    state.events = [mcpEvent("e1", "application.details_updated", { customTitle: { before: "Engineer", after: "Staff Engineer" } })]
    expect(await undoLastChange(OWNER, APP)).toEqual({ data: expect.objectContaining({ reverted: { title: { from: "Staff Engineer", to: "Engineer" } } }) })

    state.app.followUpDueAt = null
    state.events = [followUpEvent(null)]
    expect(await undoLastChange(OWNER, APP)).toEqual({ data: expect.objectContaining({ changed: true }) })
  })

  it("refuses when the field was changed since by someone else, and writes nothing", async () => {
    state.app.followUpDueAt = new Date("2026-12-24T09:00:00.000Z") // the owner moved it in the web app afterwards
    state.events = [followUpEvent("2026-11-18T09:00:00.000Z")]
    const result = await undoLastChange(OWNER, APP)
    expect(result).toEqual({ error: expect.stringMatching(/^Not undone: follow_up_due_at has been changed since the agent set it/) })
    expect(writes()).toHaveLength(0)
  })

  it("refuses to revert part of a change when any revertible field moved on", async () => {
    state.app.customTitle = "Staff Engineer"
    state.app.customCompany = "Someone Else Ltd"
    state.events = [mcpEvent("e1", "application.details_updated", {
      customTitle: { before: "Engineer", after: "Staff Engineer" },
      customCompany: { before: "Acme", after: "Acme Ltd" },
    })]
    expect(await undoLastChange(OWNER, APP)).toEqual({ error: expect.stringContaining("company has been changed") })
    expect(writes()).toHaveLength(0)
  })

  it("refuses to restore note text (the audit trail only keeps its length)", async () => {
    state.events = [mcpEvent("e1", "application.notes_updated", { notes: { before: { present: false, characters: 0 }, after: { present: true, characters: 30 } } })]
    expect(await undoLastChange(OWNER, APP)).toEqual({ error: expect.stringContaining("only touched notes") })
    expect(writes()).toHaveLength(0)
  })

  it("reverts the date but reports the note it cannot restore", async () => {
    state.app.followUpDueAt = new Date("2026-11-18T09:00:00.000Z")
    state.events = [mcpEvent("e1", "application.follow_up_updated", {
      followUpDueAt: { before: null, after: "2026-11-18T09:00:00.000Z" },
      followUpNotes: { before: { present: false, characters: 0 }, after: { present: true, characters: 5 } },
    })]
    expect(await undoLastChange(OWNER, APP)).toEqual({ data: expect.objectContaining({ not_reverted: ["followUpNotes"] }) })
  })

  it("ignores changes that were not made through the agent connection", async () => {
    state.events = [{ id: "w1", eventType: "application.follow_up_updated", metadata: { changes: { followUpDueAt: { before: null, after: "2026-11-18T09:00:00.000Z" } } }, createdAt: NOW }]
    expect(await undoLastChange(OWNER, APP)).toEqual({ error: expect.stringContaining("no change made through the agent connection") })
    expect(writes()).toHaveLength(0)
  })

  it("refuses an agent change it cannot reverse (adding an application)", async () => {
    state.events = [{ id: "c1", eventType: "application.created", metadata: { source: "mcp" }, createdAt: NOW }]
    expect(await undoLastChange(OWNER, APP)).toEqual({ error: expect.stringContaining("application.created") })
    expect(writes()).toHaveLength(0)
  })

  it("an undone change is not undone twice; the next call steps back to the one before", async () => {
    state.app.customTitle = "Engineer"
    state.events = [
      mcpEvent("u1", "application.follow_up_updated", { followUpDueAt: { before: "2026-11-18T09:00:00.000Z", after: "2026-11-10T09:00:00.000Z" } }, 1, { undoes: ["e1"] }),
      followUpEvent("2026-11-18T09:00:00.000Z"),
      mcpEvent("e0", "application.details_updated", { customTitle: { before: "Dev", after: "Engineer" } }, 10),
    ]
    expect(await undoLastChange(OWNER, APP)).toEqual({ data: expect.objectContaining({ reverted_event: expect.objectContaining({ event_id: "e0" }) }) })
  })

  describe("status changes", () => {
    const statusEvent = (id: string, from: string, to: string, msAgo: number, extra: Record<string, unknown> = {}): AuditEvent => ({
      id,
      eventType: "application.status_changed",
      metadata: { source: "mcp", fromStatus: from, toStatus: to, intent: "progress", ...extra },
      createdAt: new Date(NOW.getTime() - msAgo),
    })

    it("moves a multi-step change back to where it started, as a correction", async () => {
      state.app.status = "interview"
      state.events = [
        statusEvent("s3", "screening", "interview", 60_000),
        statusEvent("s2", "applied", "screening", 60_001),
        statusEvent("s1", "saved", "applied", 60_002),
      ]
      const result = await undoLastChange(OWNER, APP)
      expect(result).toEqual({ data: expect.objectContaining({ changed: true, before: { status: "interview" }, after: { status: "saved" } }) })
      const audit = auditInserts()[0].params.filter((param) => typeof param === "string")
      expect(audit.join("")).toContain('"undoes":["s3","s2","s1"]')
      expect(audit.join("")).toContain('"intent":"correction"')
    })

    it("only walks back over steps of the same change", async () => {
      state.app.status = "screening"
      state.events = [
        statusEvent("s2", "applied", "screening", 60_000),
        statusEvent("s1", "saved", "applied", 3 * DAY),
      ]
      expect(await undoLastChange(OWNER, APP)).toEqual({ data: expect.objectContaining({ after: { status: "applied" } }) })
    })

    it("reopens an application the agent closed", async () => {
      state.app.status = "rejected"
      state.events = [statusEvent("s1", "interview", "rejected", 60_000)]
      expect(await undoLastChange(OWNER, APP)).toEqual({ data: expect.objectContaining({ before: { status: "rejected" }, after: { status: "interview" } }) })
      expect(auditInserts()[0].params.join("")).toContain('"intent":"reopen"')
    })

    it("refuses when the status changed since", async () => {
      state.app.status = "offer"
      state.events = [statusEvent("s1", "applied", "screening", 60_000)]
      expect(await undoLastChange(OWNER, APP)).toEqual({ error: expect.stringContaining('now "offer"') })
      expect(writes()).toHaveLength(0)
    })
  })
})
