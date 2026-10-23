import { beforeEach, describe, expect, it, vi } from "vitest"

const { db, retrieve, list, projectSubscription } = vi.hoisted(() => ({
  db: { execute: vi.fn() },
  retrieve: vi.fn(),
  list: vi.fn(),
  projectSubscription: vi.fn(),
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("./store", () => ({ projectSubscription }))
vi.mock("./stripe", () => ({ getStripe: () => ({ subscriptions: { retrieve, list } }) }))

import { reconcileSubscriptions } from "./reconcile"

describe("reconcileSubscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    list.mockResolvedValue({ data: [] })
  })

  it("projects every live subscription and keeps going after a per-row failure", async () => {
    db.execute.mockResolvedValue([{ stripe_subscription_id: "sub_1" }, { stripe_subscription_id: "sub_2" }])
    retrieve.mockRejectedValueOnce(new Error("No such subscription")).mockResolvedValueOnce({ id: "sub_2", customer: "cus_1" })

    const result = await reconcileSubscriptions()

    expect(result).toEqual({ checked: 2, failed: 1, errors: ["sub_1: No such subscription"], duplicates: [] })
    expect(projectSubscription).toHaveBeenCalledTimes(1)
    expect(projectSubscription).toHaveBeenCalledWith({ id: "sub_2", customer: "cus_1" }, expect.any(Number))
  })

  it("is a no-op with no live subscriptions", async () => {
    db.execute.mockResolvedValue([])
    expect(await reconcileSubscriptions()).toEqual({ checked: 0, failed: 0, errors: [], duplicates: [] })
    expect(retrieve).not.toHaveBeenCalled()
  })

  it("reports an extra live subscription on the same customer without touching it", async () => {
    db.execute.mockResolvedValue([{ stripe_subscription_id: "sub_1" }])
    retrieve.mockResolvedValue({ id: "sub_1", customer: "cus_1" })
    list.mockResolvedValue({ data: [
      { id: "sub_1", status: "active" },
      { id: "sub_dup", status: "active" },
      { id: "sub_old", status: "canceled" },
    ] })
    const error = vi.spyOn(console, "error").mockImplementation(() => {})

    const result = await reconcileSubscriptions()

    expect(result.duplicates).toEqual(["sub_dup (customer cus_1, tracked sub_1)"])
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
