import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), limit: vi.fn(), findCustomer: vi.fn(), findSubscription: vi.fn(), createPortal: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })) }))
vi.mock("@/lib/rate-limit", () => ({ billingRateLimit: { limit: mocks.limit } }))
vi.mock("@/lib/billing/store", () => ({ findStripeCustomerId: mocks.findCustomer, findStripeSubscriptionId: mocks.findSubscription }))
vi.mock("@/lib/billing/stripe", () => ({
  getBillingOrigin: () => "https://jobclock.test",
  getStripe: () => ({ billingPortal: { sessions: { create: mocks.createPortal } } }),
}))

import { POST } from "./route"

const post = (body?: unknown) =>
  POST(new Request("https://jobclock.test/api/billing/portal", { method: "POST", body: body ? JSON.stringify(body) : undefined }))

describe("POST /api/billing/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BILLING_ENABLED = "true"
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.limit.mockResolvedValue({ success: true })
    mocks.findCustomer.mockResolvedValue("cus_server_owned")
    mocks.findSubscription.mockResolvedValue("sub_server_owned")
    mocks.createPortal.mockResolvedValue({ url: "https://billing.stripe.test/session" })
  })

  it("rejects unauthenticated requests", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    expect((await post()).status).toBe(401)
  })

  it("uses the stored customer id", async () => {
    const response = await post()
    expect(response.status).toBe(200)
    expect(mocks.createPortal).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_server_owned" }))
  })

  it("deep-links to cancel using the server-owned subscription id", async () => {
    await post({ flow: "cancel", subscription: "sub_from_browser" })
    expect(mocks.createPortal).toHaveBeenCalledWith(expect.objectContaining({
      flow_data: { type: "subscription_cancel", subscription_cancel: { subscription: "sub_server_owned" } },
    }))
  })

  it("deep-links to plan switching", async () => {
    await post({ flow: "switch" })
    expect(mocks.createPortal).toHaveBeenCalledWith(expect.objectContaining({
      flow_data: { type: "subscription_update", subscription_update: { subscription: "sub_server_owned" } },
    }))
  })

  it("falls back to the portal home if Stripe rejects the flow", async () => {
    mocks.createPortal.mockRejectedValueOnce(new Error("feature disabled"))
    const response = await post({ flow: "switch" })
    expect(response.status).toBe(200)
    expect(mocks.createPortal).toHaveBeenLastCalledWith({ customer: "cus_server_owned", return_url: "https://jobclock.test/settings?tab=billing" })
  })
})
