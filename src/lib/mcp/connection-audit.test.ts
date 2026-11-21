import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", async () => ({ db: (await import("./fake-db")).fakeDb }))

import { appendApplicationAuditEvents } from "@/lib/applications/audit"
import { listConnectionActivity } from "./activity"
import { runAsConnection } from "./connection-context"
import { expectAllQueriesScopedTo, fakeDb, recorded, resetFakeDb, row } from "./fake-db"

const USER = "11111111-1111-4111-8111-111111111111"
const APP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const metadataOfInsert = () => JSON.parse(recorded.find((query) => /^insert into "application_audit_events"/.test(query.sql))!.params.find((p) => typeof p === "string" && p.startsWith("{")) as string)

describe("audit events record which connection made the change", () => {
  beforeEach(() => resetFakeDb())

  it("tags a change made through a token or connected app with its kind and id", async () => {
    await runAsConnection({ kind: "token", id: "tok-1", dailyCreateCap: 100, dailyDeleteCap: 10, dailyCreditCap: 20 }, () =>
      appendApplicationAuditEvents(fakeDb as never, { applicationId: APP, userId: USER, eventType: "application.notes_updated", metadata: { source: "mcp" } }))
    expect(metadataOfInsert()).toEqual({ connectionKind: "token", connectionId: "tok-1", source: "mcp" })
  })

  it("tags every event of a multi-step change", async () => {
    await runAsConnection({ kind: "oauth", id: "grant-1", dailyCreateCap: 0, dailyDeleteCap: 10, dailyCreditCap: 20 }, () =>
      appendApplicationAuditEvents(fakeDb as never, [
        { applicationId: APP, userId: USER, eventType: "application.status_changed", metadata: { fromStatus: "saved", toStatus: "applied" } },
        { applicationId: APP, userId: USER, eventType: "application.status_changed", metadata: { fromStatus: "applied", toStatus: "interview" } },
      ]))
    const inserts = recorded.filter((query) => /^insert into "application_audit_events"/.test(query.sql))
    expect(inserts[0].params.filter((p) => typeof p === "string" && p.includes("grant-1"))).toHaveLength(2)
  })

  it("leaves a change made in the web app untagged", async () => {
    await appendApplicationAuditEvents(fakeDb as never, { applicationId: APP, userId: USER, eventType: "application.notes_updated", metadata: { source: "web" } })
    expect(metadataOfInsert()).toEqual({ source: "web" })
  })
})

describe("listConnectionActivity", () => {
  const event = (id: string, connectionId: string, eventType: string, at: string, extra: Record<string, unknown> = {}, slug: string | null = "acme-eng") =>
    row(["id", "eventType", "metadata", "createdAt", "slug", "customTitle", "jobTitle"], { id, eventType, metadata: { source: "mcp", connectionId, ...extra }, createdAt: new Date(at), slug, jobTitle: slug ? "Engineer" : null })

  /** The same rows answer the application query only; profile events are a separate table. */
  const applicationEvents = (rows: unknown[][]) => ({ sql }: { sql: string }) => (/from "application_audit_events"/.test(sql) ? rows : [])

  beforeEach(() => resetFakeDb())

  it("lists profile and interview edits next to application changes, naming the tool and never any text", async () => {
    resetFakeDb(({ sql }) =>
      /from "profile_audit_events"/.test(sql)
        ? [row(["id", "eventType", "metadata", "createdAt"], { id: "p1", eventType: "interview.story_updated", metadata: { source: "mcp", connectionId: "tok-1", fields: ["action"], lengths: { action: 120 } }, createdAt: new Date("2026-11-20T13:00:00Z") })]
        : /from "application_audit_events"/.test(sql)
          ? [event("e1", "tok-1", "application.created", "2026-11-20T10:00:00Z")]
          : [],
    )
    const items = (await listConnectionActivity(USER))["tok-1"]
    expect(items.map((item) => item.tool)).toEqual(["update_story", "add_application"])
    expect(items[0]).toMatchObject({ applicationSlug: null, applicationTitle: "Profile and interview material" })
    expect(JSON.stringify(items)).not.toContain("120")
  })

  it("groups by connection, newest first, naming the tool, the application and the status change", async () => {
    resetFakeDb(applicationEvents([
      event("e3", "tok-1", "application.status_changed", "2026-11-20T12:00:00Z", { fromStatus: "saved", toStatus: "applied" }),
      event("e2", "grant-1", "application.notes_updated", "2026-11-20T11:00:00Z"),
      event("e1", "tok-1", "application.created", "2026-11-20T10:00:00Z"),
    ]))
    const activity = await listConnectionActivity(USER)
    expect(Object.keys(activity).sort()).toEqual(["grant-1", "tok-1"])
    expect(activity["tok-1"].map((item) => item.tool)).toEqual(["update_application_status", "add_application"])
    expect(activity["tok-1"][0]).toMatchObject({ detail: "saved -> applied", applicationTitle: "Engineer", applicationSlug: "acme-eng", at: "2026-11-20T12:00:00.000Z" })
    expect(activity["grant-1"][0].tool).toBe("add_note")
  })

  it("keeps only the last N per connection", async () => {
    resetFakeDb(applicationEvents(Array.from({ length: 15 }, (_, i) => event(`e${i}`, "tok-1", "application.notes_updated", `2026-11-20T${String(23 - i).padStart(2, "0")}:00:00Z`))))
    expect((await listConnectionActivity(USER, 10))["tok-1"]).toHaveLength(10)
  })

  it("shows a removed application as such rather than failing", async () => {
    resetFakeDb(applicationEvents([event("e1", "tok-1", "application.created", "2026-11-20T10:00:00Z", {}, null)]))
    expect((await listConnectionActivity(USER))["tok-1"][0]).toMatchObject({ applicationSlug: null, applicationTitle: null })
  })

  it("names the new tools: archive, restore, tags, source, applied date, details, delete and each generation kind", async () => {
    const types: [string, Record<string, unknown>, string][] = [
      ["application.archived", {}, "archive_application"],
      ["application.restored", {}, "restore_application"],
      ["application.tags_updated", {}, "set_tags"],
      ["application.source_updated", {}, "set_source"],
      ["application.applied_at_updated", {}, "set_applied_at"],
      ["application.details_updated", {}, "update_application_details"],
      ["application.deleted", {}, "delete_application"],
      ["application.generation_requested", { kind: "company_research" }, "generate_company_research"],
      ["application.generation_requested", { kind: "cover_letter" }, "generate_cover_letter"],
      ["application.generation_requested", { kind: "cv_tailor" }, "tailor_cv"],
      ["application.generation_requested", { kind: "interview_prep" }, "generate_interview_prep"],
    ]
    resetFakeDb(applicationEvents(types.map(([type, extra], i) => event(`e${i}`, "tok-1", type, `2026-11-20T${String(10 + i).padStart(2, "0")}:00:00Z`, extra))))
    const tools = (await listConnectionActivity(USER, 20))["tok-1"].map((item) => item.tool).reverse()
    expect(tools).toEqual(types.map(([, , tool]) => tool))
  })

  it("lists a CV review as review_cv", async () => {
    resetFakeDb(({ sql }) => (/from "profile_audit_events"/.test(sql) ? [row(["id", "eventType", "metadata", "createdAt"], { id: "p1", eventType: "profile.cv_reviewed", metadata: { source: "mcp", connectionId: "tok-1", cvId: "x", credits: 2 }, createdAt: new Date("2026-11-20T13:00:00Z") })] : []))
    expect((await listConnectionActivity(USER))["tok-1"][0].tool).toBe("review_cv")
  })

  it("only ever reads the signed-in owner's events", async () => {
    await listConnectionActivity(USER)
    expectAllQueriesScopedTo(USER)
    expect(recorded.map((query) => query.sql).every((sql) => sql.includes("'connectionId'"))).toBe(true)
    expect(recorded.some((query) => query.sql.includes('"profile_audit_events"'))).toBe(true)
  })
})
