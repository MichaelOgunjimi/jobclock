import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", async () => ({ db: (await import("./fake-db")).fakeDb }))

import { applications } from "@/lib/db/schema"
import { expectAllQueriesScopedTo, recorded, resetFakeDb, row, tableRow, type RecordedQuery } from "./fake-db"
import {
  addNote,
  getApplication,
  listApplications,
  listDue,
  setFollowUp,
  setInterviewTime,
  updateApplicationStatus,
} from "./tools"

const OWNER = "11111111-1111-4111-8111-111111111111"
const INTRUDER = "22222222-2222-4222-8222-222222222222"
const APP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const NOW = new Date("2026-11-20T10:00:00.000Z")

const SUMMARY_KEYS = ["id", "slug", "status", "appliedAt", "lastStatusUpdate", "followUpDueAt", "interviewAt", "customTitle", "customCompany", "jobTitle", "jobCompany"]
const DETAIL_KEYS = [...SUMMARY_KEYS, "archivedAt", "tags", "notes", "followUpNotes", "followUpCount", "source", "postingUrl"]

/** Emulates the user_id condition: only a query bound to the owner's id sees the owner's application. */
function seedOwnerData(state: { status: string; notes: string | null; followUpDueAt: Date | null; interviewAt: Date | null }) {
  const app = () => ({
    id: APP,
    slug: "engineer-acme",
    status: state.status,
    appliedAt: null,
    lastStatusUpdate: NOW,
    followUpDueAt: state.followUpDueAt,
    interviewAt: state.interviewAt,
    customTitle: "Engineer",
    customCompany: "Acme",
    notes: state.notes,
    archivedAt: null,
    tags: ["remote"],
    followUpNotes: null,
    followUpCount: 0,
    userId: OWNER,
  })
  resetFakeDb(({ sql, params }: RecordedQuery) => {
    if (/^update "applications"/.test(sql) && params.includes(OWNER)) {
      const set = sql.slice(sql.indexOf(" set ") + 5, sql.indexOf(" where "))
      const columns = set.split(", ").map((part) => part.split(" = ")[0].replaceAll('"', ""))
      columns.forEach((column, index) => {
        if (column === "status") state.status = params[index] as string
        if (column === "notes") state.notes = params[index] as string
        if (column === "follow_up_due_at") state.followUpDueAt = params[index] as Date | null
        if (column === "interview_at") state.interviewAt = params[index] as Date | null
      })
      return []
    }
    if (!params.includes(OWNER)) return []
    const head = sql.slice(0, sql.indexOf(" from "))
    if (/from "application_status_events"/.test(sql)) return [[null, "saved", NOW]]
    if (/from "application_audit_events"/.test(sql)) return [["application.created", {}, NOW]]
    if (/from "applications"/.test(sql) && /for update/.test(sql)) {
      return /^select "id", "status", "applied_at"$/.test(head) ? [[APP, state.status, null]] : [tableRow(applications, app())]
    }
    if (/from "applications"/.test(sql)) {
      return [row(/"notes"/.test(head) ? DETAIL_KEYS : SUMMARY_KEYS, app())]
    }
    return []
  })
}

const fresh = () => ({ status: "saved", notes: null as string | null, followUpDueAt: null as Date | null, interviewAt: null as Date | null })
const writes = () => recorded.filter((query) => /^(insert|update|delete)/i.test(query.sql))

describe("every tool is scoped to the token owner's user_id", () => {
  beforeEach(() => seedOwnerData(fresh()))

  const calls: [string, (userId: string) => Promise<unknown>][] = [
    ["list_applications", (u) => listApplications(u, { status: "saved", overdueFollowUps: true, search: "acme", limit: 5 })],
    ["get_application", (u) => getApplication(u, APP)],
    ["update_application_status", (u) => updateApplicationStatus(u, APP, "applied", "progress")],
    ["set_follow_up", (u) => setFollowUp(u, APP, { dueAt: "2026-12-01T09:00:00+00:00", note: "ping" })],
    ["set_interview_time", (u) => setInterviewTime(u, APP, "2026-12-02T14:30:00+00:00")],
    ["add_note", (u) => addNote(u, APP, "Recruiter called", NOW)],
    ["list_due", (u) => listDue(u, 7, NOW)],
  ]

  it.each(calls)("%s binds every query to the owner and only the owner", async (_name, call) => {
    await call(OWNER)
    expectAllQueriesScopedTo(OWNER, [INTRUDER])
  })

  it.each(calls)("%s with another user's token sees nothing and writes nothing", async (_name, call) => {
    const result = (await call(INTRUDER)) as { data?: Record<string, unknown>; error?: string }
    expectAllQueriesScopedTo(INTRUDER, [OWNER])
    expect(writes().filter((query) => /^(update|delete)/i.test(query.sql))).toHaveLength(0)
    expect(writes().some((query) => /audit/.test(query.sql))).toBe(false)
    expect(JSON.stringify(result)).not.toContain("Acme")
    expect(JSON.stringify(result)).not.toContain(APP + "\"") // never echoes the owner's data
    if (result.error) expect(result.error).toBe("Application not found.")
  })

  it("the scoping assertion itself fails on an unscoped query", () => {
    resetFakeDb()
    recorded.push({ sql: 'select "id" from "applications" where "applications"."id" = $1', params: [APP] })
    expect(() => expectAllQueriesScopedTo(OWNER)).toThrow()
  })
})

describe("list_applications", () => {
  it("escapes LIKE wildcards in the search text and returns small summaries", async () => {
    seedOwnerData(fresh())
    const result = await listApplications(OWNER, { search: "100%_off\\", limit: 10 })
    const query = recorded[0]
    expect(query.params).toContain("%100\\%\\_off\\\\%")
    expect(result).toEqual({
      data: {
        count: 1,
        applications: [expect.objectContaining({ id: APP, title: "Engineer", company: "Acme", status: "saved" })],
      },
    })
  })

  it("the overdue filter uses open statuses with a past follow-up date", async () => {
    seedOwnerData(fresh())
    await listApplications(OWNER, { overdueFollowUps: true, limit: 10 })
    expect(recorded[0].sql).toMatch(/"follow_up_due_at" is not null/)
    expect(recorded[0].sql).toMatch(/"follow_up_due_at" <= \$/)
    expect(recorded[0].params).toEqual(expect.arrayContaining(["applied", "screening", "interview"]))
  })
})

describe("get_application", () => {
  it("returns details, status history and recent activity", async () => {
    seedOwnerData(fresh())
    const result = await getApplication(OWNER, APP)
    expect(result).toEqual({
      data: expect.objectContaining({
        id: APP,
        notes: "",
        archived_at: null,
        tags: ["remote"],
        status_history: [{ from: null, to: "saved", at: NOW.toISOString() }],
        recent_activity: [{ type: "application.created", at: NOW.toISOString(), details: {} }],
      }),
    })
  })
})

describe("write tools return before and after, and audit the change", () => {
  it("update_application_status reuses the web app's transition logic (history + audit tagged mcp)", async () => {
    const state = fresh()
    seedOwnerData(state)
    const result = await updateApplicationStatus(OWNER, APP, "applied", "progress")
    expect(result).toEqual({
      data: expect.objectContaining({
        changed: true,
        before: { status: "saved", applied_at: null },
        after: { status: "applied", applied_at: null },
        steps: ["applied"],
      }),
    })
    const inserts = writes().filter((query) => /^insert/i.test(query.sql))
    expect(inserts.map((query) => /into "(\w+)"/.exec(query.sql)![1])).toEqual(["application_status_events", "application_audit_events"])
    expect(inserts[1].params).toContainEqual(expect.stringContaining('"source":"mcp"'))
  })

  it("update_application_status refuses an invalid move and writes nothing", async () => {
    seedOwnerData({ ...fresh(), status: "rejected" })
    const result = await updateApplicationStatus(OWNER, APP, "applied", "progress")
    expect(result).toEqual({ error: expect.stringContaining('Cannot move from "rejected" to "applied"') })
    expect(writes()).toHaveLength(0)
  })

  it("update_application_status is a no-op when the status already matches", async () => {
    seedOwnerData(fresh())
    const result = await updateApplicationStatus(OWNER, APP, "saved", "progress")
    expect(result).toEqual({ data: expect.objectContaining({ changed: false }) })
    expect(writes()).toHaveLength(0)
  })

  it("set_follow_up reports the old and new date and leaves the note alone when omitted", async () => {
    const state = { ...fresh(), followUpDueAt: new Date("2026-11-01T00:00:00.000Z") }
    seedOwnerData(state)
    const result = await setFollowUp(OWNER, APP, { dueAt: "2026-12-01T09:00:00+00:00" })
    expect(result).toEqual({
      data: expect.objectContaining({
        changed: true,
        before: { follow_up_due_at: "2026-11-01T00:00:00.000Z", follow_up_note: null },
        after: { follow_up_due_at: "2026-12-01T09:00:00.000Z", follow_up_note: null },
      }),
    })
    const update = writes().find((query) => /^update "applications"/.test(query.sql))!
    expect(update.sql).not.toMatch(/follow_up_notes/)
    expect(JSON.stringify(writes().at(-1)!.params)).toContain("application.follow_up_updated")
  })

  it("set_follow_up needs something to change", async () => {
    seedOwnerData(fresh())
    expect(await setFollowUp(OWNER, APP, {})).toEqual({ error: expect.any(String) })
    expect(recorded).toHaveLength(0)
  })

  it("set_interview_time stores the instant and can clear it", async () => {
    const state = fresh()
    seedOwnerData(state)
    const set = await setInterviewTime(OWNER, APP, "2026-12-02T14:30:00+01:00")
    expect(set).toEqual({ data: expect.objectContaining({ before: { interview_at: null }, after: { interview_at: "2026-12-02T13:30:00.000Z" } }) })
    expect(JSON.stringify(writes().at(-1)!.params)).toContain("application.interview_time_updated")

    const cleared = await setInterviewTime(OWNER, APP, null)
    expect(cleared).toEqual({ data: expect.objectContaining({ before: { interview_at: "2026-12-02T13:30:00.000Z" }, after: { interview_at: null } }) })
  })

  it("add_note appends inside the locked row and never overwrites existing notes", async () => {
    const state = { ...fresh(), notes: "Existing note" }
    seedOwnerData(state)
    const result = await addNote(OWNER, APP, " Recruiter called ", NOW)
    expect(state.notes).toBe("Existing note\n\n[2026-11-20 via AI agent] Recruiter called")
    expect(result).toEqual({
      data: expect.objectContaining({
        added: "[2026-11-20 via AI agent] Recruiter called",
        before: { notes_length: 13 },
        after: { notes_length: state.notes.length },
      }),
    })
    // the audit event records note lengths, not note content
    expect(JSON.stringify(writes().at(-1)!.params)).not.toContain("Recruiter called")
  })
})

describe("list_due", () => {
  it("groups overdue follow-ups, upcoming follow-ups and interviews", async () => {
    seedOwnerData(fresh())
    const result = (await listDue(OWNER, 14, NOW)) as { data: Record<string, unknown[]> }
    expect(Object.keys(result.data)).toEqual(["as_of", "days", "overdue_follow_ups", "upcoming_follow_ups", "upcoming_interviews"])
    expect(recorded).toHaveLength(3)
    expect(recorded.every((query) => query.params.includes(OWNER))).toBe(true)
  })
})
