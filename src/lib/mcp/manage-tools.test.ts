import { beforeEach, describe, expect, it, vi } from "vitest"

const { deleteApplicationWithAuditForUser } = vi.hoisted(() => ({ deleteApplicationWithAuditForUser: vi.fn() }))
vi.mock("@/lib/db", async () => ({ db: (await import("./fake-db")).fakeDb }))
vi.mock("@/lib/applications/audit", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/applications/audit")>()), deleteApplicationWithAuditForUser }))

import { applications } from "@/lib/db/schema"
import { runAsConnection, type McpConnection } from "./connection-context"
import { expectAllQueriesScopedTo, recorded, resetFakeDb, row, tableRow, type RecordedQuery } from "./fake-db"
import { undoLastChange } from "./inbox-tools"
import { archiveApplication, deleteApplication, restoreApplication, setAppliedAt, setSource, setTags } from "./manage-tools"

const OWNER = "11111111-1111-4111-8111-111111111111"
const INTRUDER = "22222222-2222-4222-8222-222222222222"
const APP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const NOW = new Date("2026-11-20T10:00:00.000Z")
const ARCHIVED_AT = new Date("2026-11-10T09:00:00.000Z")

const FIND_KEYS = ["id", "slug", "status", "appliedAt", "lastStatusUpdate", "followUpDueAt", "interviewAt", "customTitle", "customCompany", "jobTitle", "jobCompany", "archivedAt", "tags", "notes", "followUpNotes", "followUpCount", "source", "postingUrl"]

type AuditEvent = { id: string; eventType: string; metadata: Record<string, unknown>; createdAt: Date }
const state = { app: {} as Record<string, unknown>, events: [] as AuditEvent[], deletedCount: 0 }

const freshApp = () => ({
  id: APP, slug: "engineer-acme", userId: OWNER, status: "applied", appliedAt: null, lastStatusUpdate: NOW, followUpDueAt: null, interviewAt: null,
  customTitle: "Engineer", customCompany: "Acme", jobTitle: null, jobCompany: null, archivedAt: null, tags: null, notes: null, source: null,
})

/** Rows are only returned to a query bound to the owner's id, like the user_id condition does in the database. */
beforeEach(() => {
  state.app = freshApp()
  state.events = []
  state.deletedCount = 0
  deleteApplicationWithAuditForUser.mockReset().mockResolvedValue(true)
  resetFakeDb(({ sql, params }: RecordedQuery) => {
    if (/^update "applications"/.test(sql) && params.includes(OWNER)) {
      const set = sql.slice(sql.indexOf(" set ") + 5, sql.indexOf(" where "))
      const camel = (column: string) => column.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())
      set.split(", ").forEach((part, index) => { state.app[camel(part.split(" = ")[0].replaceAll('"', ""))] = params[index] })
      return []
    }
    if (/^(insert|update|delete)/i.test(sql) || !params.includes(OWNER)) return []
    if (/from "application_audit_events"/.test(sql)) {
      if (/count\(\*\)/.test(sql)) return [[state.deletedCount]]
      return state.events.map((event) => [event.id, event.eventType, event.metadata, event.createdAt])
    }
    if (/for update/.test(sql)) return [tableRow(applications, state.app)]
    if (/from "applications"/.test(sql)) return [row(FIND_KEYS, state.app)]
    return []
  })
})

const writes = () => recorded.filter((query) => /^(insert|update|delete)/i.test(query.sql))
const auditInserts = () => writes().filter((query) => /into "application_audit_events"/.test(query.sql))
const mcpEvent = (id: string, eventType: string, changes: Record<string, unknown>, minutesAgo = 5): AuditEvent => ({
  id, eventType, metadata: { source: "mcp", changes }, createdAt: new Date(NOW.getTime() - minutesAgo * 60_000),
})
const as = (connection: Partial<McpConnection> = {}) => <T>(fn: () => T) =>
  runAsConnection({ kind: "token", id: "tok-1", dailyCreateCap: 100, dailyDeleteCap: 10, dailyCreditCap: 20, ...connection }, fn)

describe("every manage tool is scoped to the token owner's user_id", () => {
  const calls: [string, (userId: string) => Promise<unknown>][] = [
    ["archive_application", (u) => archiveApplication(u, APP)],
    ["restore_application", (u) => restoreApplication(u, APP)],
    ["set_tags", (u) => setTags(u, APP, ["a"])],
    ["set_source", (u) => setSource(u, APP, "LinkedIn")],
    ["set_applied_at", (u) => setAppliedAt(u, APP, "2026-11-01")],
    ["delete_application", (u) => deleteApplication(u, APP, "Engineer", NOW)],
  ]
  it.each(calls)("%s binds every query to the caller and refuses a foreign id with the same error as a missing one", async (_name, call) => {
    expect(await call(INTRUDER)).toEqual({ error: "Application not found." })
    expectAllQueriesScopedTo(INTRUDER, [OWNER])
    expect(writes()).toHaveLength(0)
    expect(deleteApplicationWithAuditForUser).not.toHaveBeenCalled()
  })
})

describe("archive, restore and the tracking details return before and after and audit source mcp", () => {
  it("archive_application", async () => {
    const result = await archiveApplication(OWNER, APP)
    expect(result).toEqual({ data: expect.objectContaining({ id: APP, changed: true, before: { archived: false, archived_at: null }, after: { archived: true, archived_at: expect.any(String) } }) })
    expect(state.app.archivedAt).toEqual(expect.any(String)) // dates reach the driver as ISO strings
    expect(auditInserts()).toHaveLength(1)
    expect(auditInserts()[0].params).toContain("application.archived")
    expect(auditInserts()[0].params.join("")).toContain('"source":"mcp"')
  })

  it("archiving twice is a no-op", async () => {
    state.app.archivedAt = ARCHIVED_AT
    expect(await archiveApplication(OWNER, APP)).toEqual({ data: expect.objectContaining({ changed: false }) })
    expect(writes()).toHaveLength(0)
  })

  it("restore_application", async () => {
    state.app.archivedAt = ARCHIVED_AT
    const result = await restoreApplication(OWNER, APP)
    expect(result).toEqual({ data: expect.objectContaining({ changed: true, before: { archived: true, archived_at: ARCHIVED_AT.toISOString() }, after: { archived: false, archived_at: null } }) })
    expect(auditInserts()[0].params).toContain("application.restored")
    expect(auditInserts()[0].params.join("")).toContain('"source":"mcp"')
  })

  it("set_tags replaces the whole list with the web validation (trim, de-dupe, 20 tags, 30 characters)", async () => {
    state.app.tags = ["old"]
    expect(await setTags(OWNER, APP, ["  remote ", "Remote", "dream"])).toEqual({ data: expect.objectContaining({ changed: true, before: { tags: ["old"] }, after: { tags: ["remote", "dream"] } }) })
    expect(auditInserts()[0].params).toContain("application.tags_updated")
    expect(auditInserts()[0].params.join("")).toContain('"source":"mcp"')
    writes().length = 0
    recorded.length = 0
    expect(await setTags(OWNER, APP, Array.from({ length: 21 }, (_, i) => `t${i}`))).toEqual({ error: expect.stringMatching(/at most 20 tags/) })
    expect(await setTags(OWNER, APP, ["x".repeat(31)])).toEqual({ error: expect.stringMatching(/at most 30 characters/) })
    expect(writes()).toHaveLength(0)
  })

  it("set_source sets and clears, and rejects over 60 characters", async () => {
    expect(await setSource(OWNER, APP, " LinkedIn ")).toEqual({ data: expect.objectContaining({ changed: true, before: { source: null }, after: { source: "LinkedIn" } }) })
    expect(auditInserts()[0].params).toContain("application.source_updated")
    expect(await setSource(OWNER, APP, "x".repeat(61))).toEqual({ error: expect.stringMatching(/at most 60/) })
    state.app.source = "LinkedIn"
    expect(await setSource(OWNER, APP, null)).toEqual({ data: expect.objectContaining({ after: { source: null } }) })
  })

  it("set_applied_at stores the day, and rejects the future and a bad date", async () => {
    const result = await setAppliedAt(OWNER, APP, "2026-11-01")
    expect(result).toEqual({ data: expect.objectContaining({ changed: true, before: { applied_at: null }, after: { applied_at: "2026-11-01T12:00:00.000Z" } }) })
    expect(auditInserts()[0].params).toContain("application.applied_at_updated")
    recorded.length = 0
    expect(await setAppliedAt(OWNER, APP, "2099-01-01")).toEqual({ error: expect.stringMatching(/future/) })
    expect(await setAppliedAt(OWNER, APP, "2026-02-31")).toEqual({ error: expect.stringMatching(/valid date/) })
    expect(writes()).toHaveLength(0)
  })
})

describe("undo_last_change covers archive, restore, tags, source and applied date", () => {
  it("undoes an archive with a restore event and clears archived_at", async () => {
    state.app.archivedAt = ARCHIVED_AT
    state.events = [mcpEvent("e1", "application.archived", { archivedAt: { before: null, after: ARCHIVED_AT.toISOString() } })]
    const result = await undoLastChange(OWNER, APP)
    expect(result).toEqual({ data: expect.objectContaining({ changed: true, reverted: { archived_at: { from: ARCHIVED_AT.toISOString(), to: null } } }) })
    expect(state.app.archivedAt).toBeNull()
    expect(auditInserts()[0].params).toContain("application.restored")
    expect(auditInserts()[0].params.join("")).toContain('"undoes":["e1"]')
  })

  it("undoes a restore by archiving again at the recorded time", async () => {
    state.events = [mcpEvent("e1", "application.restored", { archivedAt: { before: ARCHIVED_AT.toISOString(), after: null } })]
    expect(await undoLastChange(OWNER, APP)).toEqual({ data: expect.objectContaining({ changed: true }) })
    expect(state.app.archivedAt).toBe(ARCHIVED_AT.toISOString())
    expect(auditInserts()[0].params).toContain("application.archived")
  })

  it("undoes tags, source and applied date from the recorded before values", async () => {
    state.app.tags = ["remote"]
    state.events = [mcpEvent("e1", "application.tags_updated", { tags: { before: ["old"], after: ["remote"] } })]
    expect(await undoLastChange(OWNER, APP)).toEqual({ data: expect.objectContaining({ reverted: { tags: { from: ["remote"], to: ["old"] } } }) })
    expect(state.app.tags).toBe('{"old"}') // arrays reach the driver as a Postgres array literal

    state.app.source = "LinkedIn"
    state.events = [mcpEvent("e2", "application.source_updated", { source: { before: null, after: "LinkedIn" } })]
    expect(await undoLastChange(OWNER, APP)).toEqual({ data: expect.objectContaining({ reverted: { source: { from: "LinkedIn", to: null } } }) })
    expect(state.app.source).toBeNull()

    state.app.appliedAt = new Date("2026-11-01T12:00:00.000Z")
    state.events = [mcpEvent("e3", "application.applied_at_updated", { appliedAt: { before: null, after: "2026-11-01T12:00:00.000Z" } })]
    expect(await undoLastChange(OWNER, APP)).toEqual({ data: expect.objectContaining({ reverted: { applied_at: { from: "2026-11-01T12:00:00.000Z", to: null } } }) })
    expect(state.app.appliedAt).toBeNull()
  })

  it.each([
    ["archive", "application.archived", "archivedAt", { before: null, after: ARCHIVED_AT.toISOString() }, { archivedAt: null }, /archived_at has been changed/],
    ["tags", "application.tags_updated", "tags", { before: [], after: ["remote"] }, { tags: ["other"] }, /tags has been changed/],
    ["source", "application.source_updated", "source", { before: null, after: "LinkedIn" }, { source: "Referral" }, /source has been changed/],
    ["applied date", "application.applied_at_updated", "appliedAt", { before: null, after: "2026-11-01T12:00:00.000Z" }, { appliedAt: new Date("2026-11-05T12:00:00.000Z") }, /applied_at has been changed/],
  ])("refuses the %s undo when the owner changed it since, and writes nothing", async (_name, eventType, field, recorded_, now, message) => {
    Object.assign(state.app, now)
    state.events = [mcpEvent("e1", eventType, { [field]: recorded_ })]
    expect(await undoLastChange(OWNER, APP)).toEqual({ error: expect.stringMatching(message) })
    expect(writes()).toHaveLength(0)
  })

  it("cannot undo a permanent deletion: the application is gone", async () => {
    state.app = {}
    resetFakeDb(() => [])
    expect(await undoLastChange(OWNER, APP)).toEqual({ error: "Application not found." })
  })
})

describe("delete_application safeguards", () => {
  const archived = () => { state.app.archivedAt = ARCHIVED_AT }

  it("refuses an application that is not archived, and deletes nothing", async () => {
    const result = await as()(() => deleteApplication(OWNER, APP, "Engineer", NOW))
    expect(result).toEqual({ error: expect.stringMatching(/not archived.*archive_application/) })
    expect(deleteApplicationWithAuditForUser).not.toHaveBeenCalled()
  })

  it("refuses a title that does not match exactly (no trimming, no case folding), without revealing the real one", async () => {
    archived()
    for (const wrong of ["engineer", "Engineer ", "Staff Engineer", "Acme Engineer"]) {
      const result = await as()(() => deleteApplication(OWNER, APP, wrong, NOW))
      expect(result, wrong).toEqual({ error: expect.stringMatching(/confirm_title does not match/) })
      expect(JSON.stringify(result)).not.toContain("Engineer\"") // the real title is not echoed back
    }
    expect(deleteApplicationWithAuditForUser).not.toHaveBeenCalled()
  })

  it("compares against the title as shown: the custom title, else the posting's", async () => {
    archived()
    state.app.customTitle = null
    state.app.jobTitle = "Posting Title"
    expect(await as()(() => deleteApplication(OWNER, APP, "Posting Title", NOW))).toEqual({ data: expect.objectContaining({ deleted: true }) })
  })

  it("a limit of 0 switches deleting off and the error names the limit and where to change it", async () => {
    archived()
    const result = await as({ dailyDeleteCap: 0 })(() => deleteApplication(OWNER, APP, "Engineer", NOW))
    expect(result).toEqual({ error: expect.stringMatching(/switched off[\s\S]*limit is 0[\s\S]*Settings -> AI Agent/) })
    expect(deleteApplicationWithAuditForUser).not.toHaveBeenCalled()
  })

  it("stops at the owner's daily limit for this connection, naming the limit and why", async () => {
    archived()
    state.deletedCount = 3
    const result = await as({ dailyDeleteCap: 3 })(() => deleteApplication(OWNER, APP, "Engineer", NOW))
    expect(result).toEqual({ error: expect.stringMatching(/Daily deletion limit reached[\s\S]*deleted 3[\s\S]*limit is 3[\s\S]*Settings -> AI Agent/) })
    expect(deleteApplicationWithAuditForUser).not.toHaveBeenCalled()
    // counted per connection and only the mcp deletions of the last 24 hours
    const count = recorded.find((query) => /count\(\*\)/.test(query.sql))!
    expect(count.params).toEqual(expect.arrayContaining([OWNER, "application.deleted", "mcp", "tok-1"]))
  })

  it("deletes through the existing audited helper: source mcp, no text recorded, archived re-checked under the lock", async () => {
    archived()
    state.deletedCount = 2
    const result = await as()(() => deleteApplication(OWNER, APP, "Engineer", NOW))
    expect(deleteApplicationWithAuditForUser).toHaveBeenCalledWith(OWNER, APP, { source: "mcp", omitText: true, requireArchived: true })
    expect(result).toEqual({ data: expect.objectContaining({ id: APP, deleted: true, permanent: true, undoable: false, deleted_by_this_connection_in_24h: 3, daily_limit: 10 }) })
    expect(JSON.stringify(result)).toMatch(/PERMANENT/)
    expect(JSON.stringify(result)).not.toContain("Engineer")
  })

  it("reports a failed delete (restored meanwhile) instead of claiming success", async () => {
    archived()
    deleteApplicationWithAuditForUser.mockResolvedValue(false)
    expect(await as()(() => deleteApplication(OWNER, APP, "Engineer", NOW))).toEqual({ error: expect.stringMatching(/changed while it was being deleted/) })
  })
})
