import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), limit: vi.fn(), findSubscription: vi.fn(), project: vi.fn(), retrieve: vi.fn(), update: vi.fn(),
}))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })) }))
vi.mock("@/lib/rate-limit", () => ({ billingRateLimit: { limit: mocks.limit } }))
vi.mock("@/lib/billing/store", () => ({ findStripeSubscriptionId: mocks.findSubscription, projectSubscription: mocks.project }))
vi.mock("@/lib/billing/stripe", () => ({
  getStripe: () => ({ subscriptions: { retrieve: mocks.retrieve, update: mocks.update } }),
}))

import { POST } from "./route"

describe("POST /api/billing/resume", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BILLING_ENABLED = "true"
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.limit.mockResolvedValue({ success: true })
    mocks.findSubscription.mockResolvedValue("sub_server_owned")
    mocks.retrieve.mockResolvedValue({ id: "sub_server_owned", status: "active", cancel_at_period_end: false, cancel_at: 1_800_000_000 })
    mocks.update.mockResolvedValue({ id: "sub_server_owned", status: "active", cancel_at_period_end: false, cancel_at: null })
  })

  it("rejects unauthenticated requests", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    expect((await POST()).status).toBe(401)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("has no subscription to resume for a user without one", async () => {
    mocks.findSubscription.mockResolvedValue(null)
    expect((await POST()).status).toBe(404)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("clears a portal-style cancel_at on the server-owned subscription and projects the result", async () => {
    const response = await POST()
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith("sub_server_owned", { cancel_at_period_end: false })
    expect(mocks.project).toHaveBeenCalledWith(expect.objectContaining({ id: "sub_server_owned", cancel_at: null }), expect.any(Number))
  })

  it("does nothing when the subscription is not cancelling", async () => {
    mocks.retrieve.mockResolvedValue({ id: "sub_server_owned", status: "active", cancel_at_period_end: false, cancel_at: null })
    expect((await POST()).status).toBe(200)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("will not resume a subscription that has already ended", async () => {
    mocks.retrieve.mockResolvedValue({ id: "sub_server_owned", status: "canceled", cancel_at_period_end: false, cancel_at: null })
    expect((await POST()).status).toBe(409)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
