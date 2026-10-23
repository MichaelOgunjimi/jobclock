import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({ db: { transaction: vi.fn() } }))
vi.mock("@/lib/db", () => ({ db }))

import { grantPurchasedCredits, releaseHostedAiAction, reserveHostedAiAction, settleHostedAiAction } from "./usage"

const input = {
  userId: "user-1",
  idempotencyKey: "job-1",
  feature: "cover_letter" as const,
  credits: 4,
  estimatedCostMicrousd: 120_000,
  period: {
    start: new Date("2026-11-01T00:00:00Z"),
    end: new Date("2026-12-01T00:00:00Z"),
    creditLimit: 100,
    costLimitMicrousd: 4_000_000,
  },
}

// Minimal drizzle tx: inserts resolve in order (periods, then actions), updates in order (period counters, then action row).
function makeTx(opts: { inserted: unknown[]; existing?: unknown; periodUpdate?: unknown[]; actionUpdate?: unknown[]; updates?: unknown[][] }) {
  const set = vi.fn()
  const insertResults = [undefined, opts.inserted]
  const updateResults = opts.updates ? [...opts.updates] : [opts.periodUpdate ?? [{}], opts.actionUpdate ?? []]
  const tx = {
    insert: vi.fn(() => ({
      values: () => {
        const result = insertResults.shift()
        return { onConflictDoNothing: () => Object.assign(Promise.resolve(result), { returning: async () => result }) }
      },
    })),
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => (opts.existing ? [opts.existing] : []) }) }) })),
    update: vi.fn(() => ({
      set: (values: unknown) => {
        set(values)
        return { where: () => ({ returning: async () => updateResults.shift() }) }
      },
    })),
  }
  db.transaction.mockImplementation(async (callback) => callback(tx))
  return { tx, set }
}

describe("reserveHostedAiAction", () => {
  beforeEach(() => vi.clearAllMocks())

  it("reserves a new action", async () => {
    const { tx } = makeTx({ inserted: [{ id: "row-1", status: "reserved" }] })
    expect(await reserveHostedAiAction(input)).toEqual({ id: "row-1", status: "reserved" })
    expect(tx.update).toHaveBeenCalledTimes(1)
  })

  it("returns an existing completed action without reserving again", async () => {
    const existing = { id: "row-1", userId: "user-1", feature: "cover_letter", status: "completed" }
    const { tx } = makeTx({ inserted: [], existing })
    expect(await reserveHostedAiAction(input)).toBe(existing)
    expect(tx.update).not.toHaveBeenCalled()
  })

  it("rejects an idempotency key owned by another user or feature", async () => {
    makeTx({ inserted: [], existing: { id: "row-1", userId: "someone-else", feature: "cover_letter", status: "failed" } })
    await expect(reserveHostedAiAction(input)).rejects.toThrow("already in use")
  })

  it("re-reserves a released action so a job retry can run", async () => {
    const existing = { id: "row-1", userId: "user-1", feature: "cover_letter", status: "failed" }
    const { tx, set } = makeTx({ inserted: [], existing, actionUpdate: [{ id: "row-1", status: "reserved" }] })

    expect(await reserveHostedAiAction(input)).toEqual({ id: "row-1", status: "reserved" })
    expect(tx.update).toHaveBeenCalledTimes(2)
    expect(set).toHaveBeenLastCalledWith(expect.objectContaining({
      status: "reserved",
      periodStart: input.period.start,
      credits: 4,
      estimatedCostMicrousd: 120_000,
      actualCostMicrousd: 0,
      settledAt: null,
    }))
  })

  it("throws when the allowance is exhausted and does not requeue", async () => {
    const existing = { id: "row-1", userId: "user-1", feature: "cover_letter", status: "failed" }
    const { tx } = makeTx({ inserted: [], existing, periodUpdate: [] })
    await expect(reserveHostedAiAction(input)).rejects.toThrow("allowance")
    // The monthly period, then the purchased balance, were tried; neither covered it, so nothing is requeued.
    expect(tx.update).toHaveBeenCalledTimes(2)
  })

  it("spends purchased credits when the monthly allowance cannot cover the action", async () => {
    const { tx, set } = makeTx({
      inserted: [{ id: "row-1", status: "reserved" }],
      updates: [[], [{ credits: 46 }], [{ id: "row-1", status: "reserved", funding: "purchased" }]],
    })

    expect(await reserveHostedAiAction(input)).toEqual({ id: "row-1", status: "reserved", funding: "purchased" })
    expect(tx.update).toHaveBeenCalledTimes(3)
    expect(set).toHaveBeenLastCalledWith({ funding: "purchased" })
  })

  it("does not touch the purchased balance while the monthly allowance covers the action", async () => {
    const { tx } = makeTx({ inserted: [{ id: "row-1", status: "reserved" }] })
    await reserveHostedAiAction(input)
    expect(tx.update).toHaveBeenCalledTimes(1)
  })
})

// Minimal drizzle tx for settle/release: updates resolve in order; inserts are recorded.
function makeSettleTx(updates: unknown[][]) {
  const insert = vi.fn(() => ({ values: () => ({ onConflictDoNothing: async () => undefined }) }))
  const tx = {
    insert,
    update: vi.fn(() => ({ set: () => ({ where: () => ({ returning: async () => updates.shift() }) }) })),
  }
  db.transaction.mockImplementation(async (callback) => callback(tx))
  return tx
}

describe("settling and releasing purchased-credit actions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("settles a purchased action without touching the monthly counters", async () => {
    const tx = makeSettleTx([[{ id: "row-1", userId: "user-1", funding: "purchased", credits: 4 }]])
    await settleHostedAiAction("row-1", [])
    expect(tx.update).toHaveBeenCalledTimes(1)
  })

  it("settles an allowance action against the monthly counters", async () => {
    const tx = makeSettleTx([[{ id: "row-1", userId: "user-1", funding: "allowance", credits: 4, estimatedCostMicrousd: 120_000 }], []])
    await settleHostedAiAction("row-1", [])
    expect(tx.update).toHaveBeenCalledTimes(2)
  })

  it("refunds a released purchased action to the balance, not the monthly period", async () => {
    const tx = makeSettleTx([[{ id: "row-1", userId: "user-1", funding: "purchased", credits: 4 }], []])
    await releaseHostedAiAction("row-1")
    expect(tx.update).toHaveBeenCalledTimes(2)
  })
})

describe("grantPurchasedCredits", () => {
  beforeEach(() => vi.clearAllMocks())

  const grant = {
    userId: "user-1", checkoutSessionId: "cs_1", pack: "credits_50" as const, credits: 50, amountPence: 750,
  }

  function makeGrantTx(purchase: unknown[]) {
    const balanceInsert = vi.fn(async () => undefined)
    let call = 0
    const tx = {
      insert: vi.fn(() => ({
        values: () => (call++ === 0
          ? { onConflictDoNothing: () => ({ returning: async () => purchase }) }
          : { onConflictDoUpdate: balanceInsert }),
      })),
    }
    db.transaction.mockImplementation(async (callback) => callback(tx))
    return { tx, balanceInsert }
  }

  it("adds the pack to the balance the first time a session is seen", async () => {
    const { balanceInsert } = makeGrantTx([{ id: "purchase-1" }])
    expect(await grantPurchasedCredits(grant)).toBe(true)
    expect(balanceInsert).toHaveBeenCalledTimes(1)
  })

  it("grants nothing when the same session is replayed", async () => {
    const { tx, balanceInsert } = makeGrantTx([])
    expect(await grantPurchasedCredits(grant)).toBe(false)
    expect(tx.insert).toHaveBeenCalledTimes(1)
    expect(balanceInsert).not.toHaveBeenCalled()
  })
})
