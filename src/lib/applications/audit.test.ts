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
