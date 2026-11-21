import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
  },
}))

vi.mock("@/lib/db", () => ({ db }))

import {
  appendApplicationAuditEvents,
  deleteApplicationWithAuditForUser,
  listApplicationAuditForUser,
  updateApplicationWithAuditForUser,
} from "./audit"

describe("application audit", () => {
  beforeEach(() => vi.clearAllMocks())

  it("appends an immutable event through the supplied transaction", async () => {
    const values = vi.fn().mockResolvedValue(undefined)
    const tx = { insert: vi.fn(() => ({ values })) }

    await appendApplicationAuditEvents(tx as never, {
      applicationId: "app-1",
      userId: "user-1",
      eventType: "application.created",
      metadata: { source: "linkedin" },
    })

    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({
        applicationId: "app-1",
        userId: "user-1",
        eventType: "application.created",
      }),
    ])
  })

  it("updates and audits atomically without copying note content", async () => {
    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const values = vi.fn().mockResolvedValue(undefined)
    const tx = {
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            limit: () => ({
              for: vi.fn().mockResolvedValue([{ id: "app-1", userId: "user-1", notes: "old private note" }]),
            }),
          }),
        }),
      })),
      update: vi.fn(() => ({ set: () => ({ where: updateWhere }) })),
      insert: vi.fn(() => ({ values })),
    }
    db.transaction.mockImplementation((callback) => callback(tx))

    expect(await updateApplicationWithAuditForUser(
      "user-1",
      "app-1",
      { notes: "new private note" },
      "application.notes_updated",
    )).toBe(true)

    expect(db.transaction).toHaveBeenCalledOnce()
    expect(updateWhere).toHaveBeenCalledOnce()
    const auditRows = values.mock.calls[0][0]
    expect(auditRows[0].metadata).toEqual({
      changes: {
        notes: {
          before: { present: true, characters: 16 },
          after: { present: true, characters: 16 },
        },
      },
    })
    expect(JSON.stringify(auditRows)).not.toContain("private note")
  })

  it("retains a safe deletion event by writing it before deleting the application", async () => {
    const values = vi.fn().mockResolvedValue(undefined)
    const deleteWhere = vi.fn().mockResolvedValue(undefined)
    const tx = {
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({
            limit: () => ({
              for: vi.fn().mockResolvedValue([{ slug: "engineer-acme", title: "Engineer", company: "Acme" }]),
            }),
          }),
        }),
      })),
      insert: vi.fn(() => ({ values })),
      delete: vi.fn(() => ({ where: deleteWhere })),
    }
    db.transaction.mockImplementation((callback) => callback(tx))

    expect(await deleteApplicationWithAuditForUser("user-1", "app-1")).toBe(true)
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({
        applicationId: "app-1",
        userId: "user-1",
        eventType: "application.deleted",
      }),
    ])
    expect(values.mock.invocationCallOrder[0]).toBeLessThan(deleteWhere.mock.invocationCallOrder[0])
  })

  function deleteTransaction(row: Record<string, unknown>) {
    const values = vi.fn().mockResolvedValue(undefined)
    const deleteWhere = vi.fn().mockResolvedValue(undefined)
    const tx = {
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => ({ for: vi.fn().mockResolvedValue([row]) }) }) }) })),
      insert: vi.fn(() => ({ values })),
      delete: vi.fn(() => ({ where: deleteWhere })),
    }
    db.transaction.mockImplementation((callback) => callback(tx))
    return { values, deleteWhere }
  }

  it("an MCP deletion records who did it (source) and never the application's slug, title or company", async () => {
    const { values, deleteWhere } = deleteTransaction({ slug: "engineer-acme", title: "Engineer", company: "Acme", archivedAt: new Date() })

    expect(await deleteApplicationWithAuditForUser("user-1", "app-1", { source: "mcp", omitText: true, requireArchived: true })).toBe(true)
    const [event] = values.mock.calls[0][0]
    expect(event).toMatchObject({ applicationId: "app-1", userId: "user-1", eventType: "application.deleted", metadata: { source: "mcp", text_omitted: true } })
    expect(JSON.stringify(event)).not.toMatch(/engineer|acme/i)
    expect(deleteWhere).toHaveBeenCalledOnce()
  })

  it("requireArchived refuses an application that is not archived: nothing is recorded or deleted", async () => {
    const { values, deleteWhere } = deleteTransaction({ slug: "engineer-acme", title: "Engineer", company: "Acme", archivedAt: null })

    expect(await deleteApplicationWithAuditForUser("user-1", "app-1", { source: "mcp", omitText: true, requireArchived: true })).toBe(false)
    expect(values).not.toHaveBeenCalled()
    expect(deleteWhere).not.toHaveBeenCalled()
  })

  it("the web delete (no options) is unchanged: it still records slug, title and company and needs no archive", async () => {
    const { values } = deleteTransaction({ slug: "engineer-acme", title: "Engineer", company: "Acme", archivedAt: null })

    expect(await deleteApplicationWithAuditForUser("user-1", "app-1")).toBe(true)
    expect(values.mock.calls[0][0][0].metadata).toEqual({ slug: "engineer-acme", title: "Engineer", company: "Acme" })
  })

  it("queries one owner's timeline with a deterministic tie-breaker", async () => {
    const orderBy = vi.fn().mockResolvedValue([{ id: "event-2" }, { id: "event-1" }])
    const where = vi.fn(() => ({ orderBy }))
    db.select.mockReturnValue({ from: () => ({ where }) })

    await expect(listApplicationAuditForUser("user-1", "app-1")).resolves.toEqual([
      { id: "event-2" },
      { id: "event-1" },
    ])
    expect(where).toHaveBeenCalledOnce()
    expect(orderBy).toHaveBeenCalledTimes(1)
    expect(orderBy.mock.calls[0]).toHaveLength(2)
  })
})
