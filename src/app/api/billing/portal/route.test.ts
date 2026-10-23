import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), limit: vi.fn(), findCustomer: vi.fn(), createPortal: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })) }))
vi.mock("@/lib/rate-limit", () => ({ billingRateLimit: { limit: mocks.limit } }))
vi.mock("@/lib/billing/store", () => ({ findStripeCustomerId: mocks.findCustomer }))
vi.mock("@/lib/billing/stripe", () => ({
  getBillingOrigin: () => "https://jobclock.test",
  getStripe: () => ({ billingPortal: { sessions: { create: mocks.createPortal } } }),
}))

import { POST } from "./route"

describe("POST /api/billing/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BILLING_ENABLED = "true"
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
    mocks.limit.mockResolvedValue({ success: true })
    mocks.findCustomer.mockResolvedValue("cus_server_owned")
    mocks.createPortal.mockResolvedValue({ url: "https://billing.stripe.test/session" })
  })

  it("rejects unauthenticated requests", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })
    expect((await POST()).status).toBe(401)
  })

  it("uses the stored customer id", async () => {
    const response = await POST()
    expect(response.status).toBe(200)
    expect(mocks.createPortal).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_server_owned" }))
  })
})

