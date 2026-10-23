import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { resolveEntitlement, SUBSCRIPTION_STATUSES } from "./entitlements"

describe("subscription entitlements", () => {
  const now = new Date("2026-10-22T12:00:00Z")

  it.each(["active", "trialing"] as const)("maps %s to Pro with hosted AI", (status) => {
    expect(resolveEntitlement({ status }, false, now)).toEqual({
      plan: "pro",
      hostedAi: true,
      inGracePeriod: false,
    })
  })

  it("shows Pro during the past-due grace period but stops hosted AI", () => {
    expect(resolveEntitlement({
      status: "past_due",
      graceEndsAt: new Date("2026-10-29T12:00:00Z"),
    }, false, now)).toEqual({ plan: "pro", hostedAi: false, inGracePeriod: true })
  })

  it.each([
    "unpaid",
    "paused",
    "incomplete",
    "incomplete_expired",
    "canceled",
  ] as const)("maps %s to Free", (status) => {
    expect(resolveEntitlement({ status }, false, now).plan).toBe("free")
  })

  it("ends the past-due UI grace at its deadline", () => {
    expect(resolveEntitlement({ status: "past_due", graceEndsAt: now }, false, now).plan).toBe("free")
  })

  it("keeps the staff override hosted without making the user Pro", () => {
    expect(resolveEntitlement(null, true, now)).toEqual({
      plan: "free",
      hostedAi: true,
      inGracePeriod: false,
    })
  })

  it("covers every supported persisted status", () => {
    expect(SUBSCRIPTION_STATUSES).toHaveLength(8)
  })
})
