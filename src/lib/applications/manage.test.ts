import { PgDialect } from "drizzle-orm/pg-core"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({ db: { transaction: vi.fn() } }))
vi.mock("@/lib/db", () => ({ db }))

import {
  archiveApplicationForUser,
  restoreApplicationForUser,
  setApplicationAppliedAtForUser,
  setApplicationSourceForUser,
  setApplicationTagsForUser,
} from "./manage"

/** A transaction whose locked select returns `row` (or nothing), recording the update and audit rows. */
function transactionFor(row: Record<string, unknown> | null) {
  const set = vi.fn(() => ({ where: updateWhere }))
  const updateWhere = vi.fn().mockResolvedValue(undefined)
  const selectWhere = vi.fn(() => ({ limit: () => ({ for: vi.fn().mockResolvedValue(row ? [row] : []) }) }))
  const values = vi.fn().mockResolvedValue(undefined)
  const tx = {
    select: vi.fn(() => ({ from: () => ({ where: selectWhere }) })),
    update: vi.fn(() => ({ set })),
    insert: vi.fn(() => ({ values })),
  }
  db.transaction.mockImplementation((callback) => callback(tx))
  return { set, values, tx, selectWhere }
}

const event = (values: ReturnType<typeof vi.fn>) => values.mock.calls[0][0][0]

describe("archive and restore", () => {
  beforeEach(() => vi.clearAllMocks())

  it("archives with an audit event and leaves the status alone", async () => {
    const { set, values } = transactionFor({ id: "a", userId: "u", status: "applied", archivedAt: null })
    const result = await archiveApplicationForUser("u", "a")

    expect(result).toMatchObject({ changed: true, before: { archivedAt: null }, after: { archivedAt: expect.any(Date) } })
    expect(set).toHaveBeenCalledWith({ archivedAt: expect.any(Date) })
    expect(event(values)).toMatchObject({ applicationId: "a", userId: "u", eventType: "application.archived" })
    expect(event(values).metadata.changes.archivedAt.before).toBeNull()
  })

  it("is a no-op when already archived: no update, no event, same timestamp", async () => {
    const archivedAt = new Date("2026-11-01T10:00:00Z")
    const { set, values } = transactionFor({ id: "a", userId: "u", archivedAt })
    expect(await archiveApplicationForUser("u", "a")).toMatchObject({ changed: false, after: { archivedAt } })
    expect(set).not.toHaveBeenCalled()
    expect(values).not.toHaveBeenCalled()
  })

  it("restores with an audit event and is a no-op when not archived", async () => {
    const archived = transactionFor({ id: "a", userId: "u", archivedAt: new Date("2026-11-01T10:00:00Z") })
    expect(await restoreApplicationForUser("u", "a")).toMatchObject({ changed: true, after: { archivedAt: null } })
    expect(archived.set).toHaveBeenCalledWith({ archivedAt: null })
    expect(event(archived.values).eventType).toBe("application.restored")

    const live = transactionFor({ id: "a", userId: "u", archivedAt: null })
    expect(await restoreApplicationForUser("u", "a")).toMatchObject({ changed: false })
    expect(live.values).not.toHaveBeenCalled()
  })

  it("returns null for an application the user does not own (the lookup is scoped by user)", async () => {
    const { set, values, selectWhere } = transactionFor(null)
    expect(await archiveApplicationForUser("someone-else", "a")).toBeNull()
    const lookup = new PgDialect().sqlToQuery((selectWhere.mock.calls[0] as unknown[])[0] as never)
    expect(lookup.sql).toContain('"applications"."user_id" = $')
    expect(lookup.params).toEqual(["a", "someone-else"])
    expect(set).not.toHaveBeenCalled()
    expect(values).not.toHaveBeenCalled()
  })
})

describe("setApplicationTagsForUser", () => {
  beforeEach(() => vi.clearAllMocks())

  it("saves the normalised tags with before and after in the audit event", async () => {
    const { set, values } = transactionFor({ id: "a", userId: "u", tags: ["old"] })
    await setApplicationTagsForUser("u", "a", [" Remote ", "remote", "London"])

    expect(set).toHaveBeenCalledWith({ tags: ["Remote", "London"] })
    expect(event(values)).toMatchObject({
      eventType: "application.tags_updated",
      metadata: { changes: { tags: { before: ["old"], after: ["Remote", "London"] } } },
    })
  })

  it("treats a missing list and an empty list as the same, and unchanged tags as no change", async () => {
    const empty = transactionFor({ id: "a", userId: "u", tags: null })
    expect(await setApplicationTagsForUser("u", "a", [])).toMatchObject({ changed: false })
    expect(empty.values).not.toHaveBeenCalled()

    const same = transactionFor({ id: "a", userId: "u", tags: ["Remote"] })
    expect(await setApplicationTagsForUser("u", "a", ["REMOTE"])).toMatchObject({ changed: true }) // casing is a real change
    expect(same.set).toHaveBeenCalledWith({ tags: ["REMOTE"] })
  })

  it("rejects invalid tags before touching the database", async () => {
    expect(await setApplicationTagsForUser("u", "a", ["x".repeat(31)])).toEqual({ error: expect.stringContaining("30 characters") })
    expect(await setApplicationTagsForUser("u", "a", Array.from({ length: 21 }, (_, i) => `t${i}`))).toEqual({ error: expect.stringContaining("at most 20") })
    expect(db.transaction).not.toHaveBeenCalled()
  })
})

describe("setApplicationSourceForUser", () => {
  beforeEach(() => vi.clearAllMocks())

  it("saves a trimmed source and records the change", async () => {
    const { set, values } = transactionFor({ id: "a", userId: "u", source: "Indeed" })
    await setApplicationSourceForUser("u", "a", "  LinkedIn ")
    expect(set).toHaveBeenCalledWith({ source: "LinkedIn" })
    expect(event(values)).toMatchObject({
      eventType: "application.source_updated",
      metadata: { changes: { source: { before: "Indeed", after: "LinkedIn" } } },
    })
  })

  it("clears with an empty value and rejects an over-long one", async () => {
    const { set } = transactionFor({ id: "a", userId: "u", source: "Indeed" })
    await setApplicationSourceForUser("u", "a", "  ")
    expect(set).toHaveBeenCalledWith({ source: null })
    expect(await setApplicationSourceForUser("u", "a", "x".repeat(61))).toEqual({ error: expect.any(String) })
  })

  it("records who made the change when a source is given", async () => {
    const { values } = transactionFor({ id: "a", userId: "u", source: null })
    await setApplicationSourceForUser("u", "a", "Referral", "mcp")
    expect(event(values).metadata.source).toBe("mcp")
  })
})

describe("setApplicationAppliedAtForUser", () => {
  const now = new Date("2026-11-21T08:00:00Z")
  beforeEach(() => vi.clearAllMocks())

  it("sets the date at noon UTC with before and after", async () => {
    const { set, values } = transactionFor({ id: "a", userId: "u", appliedAt: new Date("2026-11-10T09:30:00Z") })
    await setApplicationAppliedAtForUser("u", "a", "2026-11-05", undefined, now)
    expect(set).toHaveBeenCalledWith({ appliedAt: new Date("2026-11-05T12:00:00Z") })
    expect(event(values)).toMatchObject({
      eventType: "application.applied_at_updated",
      metadata: { changes: { appliedAt: { before: "2026-11-10T09:30:00.000Z", after: "2026-11-05T12:00:00.000Z" } } },
    })
  })

  it("keeps the stored instant when the same day is submitted again", async () => {
    const { set, values } = transactionFor({ id: "a", userId: "u", appliedAt: new Date("2026-11-10T09:30:00Z") })
    expect(await setApplicationAppliedAtForUser("u", "a", "2026-11-10", undefined, now)).toMatchObject({ changed: false })
    expect(set).not.toHaveBeenCalled()
    expect(values).not.toHaveBeenCalled()
  })

  it("clears the date", async () => {
    const { set } = transactionFor({ id: "a", userId: "u", appliedAt: new Date("2026-11-10T09:30:00Z") })
    await setApplicationAppliedAtForUser("u", "a", null, undefined, now)
    expect(set).toHaveBeenCalledWith({ appliedAt: null })
  })

  it("rejects a far-future or invalid date without a transaction", async () => {
    expect(await setApplicationAppliedAtForUser("u", "a", "2027-01-01", undefined, now)).toEqual({ error: "The applied date can't be in the future." })
    expect(await setApplicationAppliedAtForUser("u", "a", "yesterday", undefined, now)).toEqual({ error: "Enter a valid date." })
    expect(db.transaction).not.toHaveBeenCalled()
  })
})
