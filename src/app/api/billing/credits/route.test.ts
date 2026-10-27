import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), limit: vi.fn(), findCustomer: vi.fn(), isPro: vi.fn(), createCheckout: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}))
vi.mock("@/lib/rate-limit", () => ({ billingRateLimit: { limit: mocks.limit } }))
vi.mock("@/lib/billing/store", () => ({
  findStripeCustomerId: mocks.findCustomer,
  hasActiveProSubscription: mocks.isPro,
}))
vi.mock("@/lib/billing/stripe", () => ({
  checkoutIntegrationIdentifier: () => "jobclock_abcdefgh",
  getBillingOrigin: () => "https://jobclock.test",
  getStripe: () => ({ checkout: { sessions: { create: mocks.createCheckout } } }),
}))

import { POST } from "./route"

const post = (body?: unknown) => POST(new Request("http://localhost/api/billing/credits", {
  method: "POST", body: body === undefined ? undefined : JSON.stringify(body),
}))

describe("POST /api/billing/credits", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BILLING_ENABLED = "true"
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.limit.mockResolvedValue({ success: true })
    mocks.isPro.mockResolvedValue(true)
    mocks.findCustomer.mockResolvedValue("cus_1")
    mocks.createCheckout.mockResolvedValue({ url: "https://checkout.stripe.test/credits" })
  })

  it("is unavailable while billing is disabled", async () => {
    process.env.BILLING_ENABLED = "false"
    expect((await post({ pack: "credits_50" })).status).toBe(503)
  })

  it("rejects unauthenticated requests", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    expect((await post({ pack: "credits_50" })).status).toBe(401)
  })

  it("rejects an unknown pack", async () => {
    expect((await post({ pack: "credits_9999" })).status).toBe(400)
    expect(mocks.createCheckout).not.toHaveBeenCalled()
  })

  it("only sells packs to Pro subscribers", async () => {
    mocks.isPro.mockResolvedValue(false)
    expect((await post({ pack: "credits_50" })).status).toBe(403)
    expect(mocks.createCheckout).not.toHaveBeenCalled()
  })

  it("charges the server-owned price for the pack and tags the session for the webhook", async () => {
    const response = await post({ pack: "credits_150", amountPence: 1 })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.test/credits" })
    expect(mocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      mode: "payment",
      customer: "cus_1",
      line_items: [expect.objectContaining({ price_data: expect.objectContaining({ currency: "gbp", unit_amount: 1_000 }) })],
      metadata: { jobclock_kind: "credit_pack", jobclock_user_id: "user-1", pack: "credits_150" },
    }))
  })
})
