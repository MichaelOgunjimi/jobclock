import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), limit: vi.fn(), findCustomer: vi.fn(), saveCustomer: vi.fn(),
  hasSubscription: vi.fn(), createCustomer: vi.fn(), createCheckout: vi.fn(), listSubscriptions: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}))
vi.mock("@/lib/rate-limit", () => ({ billingRateLimit: { limit: mocks.limit } }))
vi.mock("@/lib/billing/store", () => ({
  findStripeCustomerId: mocks.findCustomer,
  saveStripeCustomer: mocks.saveCustomer,
  hasPurchasableSubscription: mocks.hasSubscription,
}))
vi.mock("@/lib/billing/stripe", () => ({
  checkoutIntegrationIdentifier: () => "jobclock_abcdefgh",
  getBillingOrigin: () => "https://jobclock.test",
  getStripe: () => ({
    customers: { create: mocks.createCustomer },
    subscriptions: { list: mocks.listSubscriptions },
    checkout: { sessions: { create: mocks.createCheckout } },
  }),
}))

import { POST } from "./route"

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BILLING_ENABLED = "true"
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID = "price_month"
    process.env.STRIPE_PRO_ANNUAL_PRICE_ID = "price_year"
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "u@example.com" } } })
    mocks.limit.mockResolvedValue({ success: true })
    mocks.hasSubscription.mockResolvedValue(false)
    mocks.findCustomer.mockResolvedValue("cus_1")
    mocks.listSubscriptions.mockResolvedValue({ data: [] })
    mocks.createCheckout.mockResolvedValue({ url: "https://checkout.stripe.test/session" })
  })

  it("rejects unauthenticated requests", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    const response = await POST(new Request("http://localhost/api/billing/checkout", { method: "POST" }))
    expect(response.status).toBe(401)
  })

  it("accepts only a server-owned cadence and price", async () => {
    const response = await POST(new Request("http://localhost/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ cadence: "monthly", priceId: "price_attacker" }),
    }))
    expect(response.status).toBe(200)
    expect(mocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      customer: "cus_1",
      line_items: [{ price: "price_month", quantity: 1 }],
      allow_promotion_codes: false,
    }))
  })

  it("sends a user who backs out of Checkout to the page they came from", async () => {
    const response = await POST(new Request("http://localhost/api/billing/checkout", {
      method: "POST", body: JSON.stringify({ cadence: "monthly", returnPath: "/settings?tab=ai" }),
    }))
    expect(response.status).toBe(200)
    expect(mocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ cancel_url: "https://jobclock.test/settings?tab=ai" }))
  })

  it("falls back to pricing when no return path is given", async () => {
    await POST(new Request("http://localhost/api/billing/checkout", { method: "POST", body: JSON.stringify({ cadence: "monthly" }) }))
    expect(mocks.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ cancel_url: "https://jobclock.test/pricing?checkout=canceled" }))
  })

  it.each(["https://evil.test/", "//evil.test", "javascript:alert(1)", "/\\evil.test"])("rejects the return path %s", async (returnPath) => {
    const response = await POST(new Request("http://localhost/api/billing/checkout", {
      method: "POST", body: JSON.stringify({ cadence: "monthly", returnPath }),
    }))
    expect(response.status).toBe(400)
    expect(mocks.createCheckout).not.toHaveBeenCalled()
  })

  it("rejects a duplicate subscription", async () => {
    mocks.hasSubscription.mockResolvedValue(true)
    const response = await POST(new Request("http://localhost/api/billing/checkout", {
      method: "POST", body: JSON.stringify({ cadence: "annual" }),
    }))
    expect(response.status).toBe(409)
    expect(mocks.createCheckout).not.toHaveBeenCalled()
  })

  it("blocks a second purchase when Stripe already has a live subscription the local database missed", async () => {
    mocks.listSubscriptions.mockResolvedValue({ data: [{ status: "active" }] })
    const response = await POST(new Request("https://jobclock.test/api/billing/checkout", { method: "POST", body: JSON.stringify({ cadence: "annual" }) }) as never)
    expect(response.status).toBe(409)
    expect(mocks.createCheckout).not.toHaveBeenCalled()
  })

  it("ignores canceled subscriptions when checking for duplicates", async () => {
    mocks.listSubscriptions.mockResolvedValue({ data: [{ status: "canceled" }] })
    const response = await POST(new Request("https://jobclock.test/api/billing/checkout", { method: "POST", body: JSON.stringify({ cadence: "annual" }) }) as never)
    expect(response.status).toBe(200)
  })
})
