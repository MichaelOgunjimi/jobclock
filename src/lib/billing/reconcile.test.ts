import { beforeEach, describe, expect, it, vi } from "vitest"

const { db, retrieve, projectSubscription } = vi.hoisted(() => ({
  db: { execute: vi.fn() },
  retrieve: vi.fn(),
  projectSubscription: vi.fn(),
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("./store", () => ({ projectSubscription }))
vi.mock("./stripe", () => ({ getStripe: () => ({ subscriptions: { retrieve } }) }))

import { reconcileSubscriptions } from "./reconcile"

describe("reconcileSubscriptions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("projects every live subscription and keeps going after a per-row failure", async () => {
    db.execute.mockResolvedValue([{ stripe_subscription_id: "sub_1" }, { stripe_subscription_id: "sub_2" }])
    retrieve.mockRejectedValueOnce(new Error("No such subscription")).mockResolvedValueOnce({ id: "sub_2" })

    const result = await reconcileSubscriptions()

    expect(result).toEqual({ checked: 2, failed: 1, errors: ["sub_1: No such subscription"] })
    expect(projectSubscription).toHaveBeenCalledTimes(1)
    expect(projectSubscription).toHaveBeenCalledWith({ id: "sub_2" }, expect.any(Number))
  })

  it("is a no-op with no live subscriptions", async () => {
    db.execute.mockResolvedValue([])
    expect(await reconcileSubscriptions()).toEqual({ checked: 0, failed: 0, errors: [] })
    expect(retrieve).not.toHaveBeenCalled()
  })
})
