import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ construct: vi.fn(), begin: vi.fn(), finish: vi.fn(), project: vi.fn(), findUser: vi.fn(), grant: vi.fn(), useJobclock: vi.fn(), retrieve: vi.fn() }))
vi.mock("@/lib/billing/stripe", () => ({ getStripe: () => ({
  webhooks: { constructEvent: mocks.construct }, subscriptions: { retrieve: mocks.retrieve },
}) }))
vi.mock("@/lib/billing/store", () => ({
  beginWebhookEvent: mocks.begin, finishWebhookEvent: mocks.finish, projectSubscription: mocks.project,
  findUserIdByStripeCustomer: mocks.findUser, preferJobclockAiForNewSubscriber: mocks.useJobclock,
}))
vi.mock("@/lib/billing/usage", () => ({ grantPurchasedCredits: mocks.grant }))

import { POST } from "./route"

function request() {
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST", body: "raw-body", headers: { "stripe-signature": "sig" },
  })
}

describe("POST /api/billing/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test"
  })

  it("rejects an invalid signature before writing", async () => {
    mocks.construct.mockImplementation(() => { throw new Error("bad signature") })
    const response = await POST(request())
    expect(response.status).toBe(400)
    expect(mocks.begin).not.toHaveBeenCalled()
  })

  it("does not process a duplicate event", async () => {
    const event = { id: "evt_1", type: "customer.subscription.updated", created: 1, data: { object: {} } }
    mocks.construct.mockReturnValue(event)
    mocks.begin.mockResolvedValue(false)
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(mocks.project).not.toHaveBeenCalled()
  })

  it("projects a verified subscription event and marks it processed", async () => {
    const subscription = { id: "sub_1" }
    const event = { id: "evt_1", type: "customer.subscription.updated", created: 123, data: { object: subscription } }
    mocks.construct.mockReturnValue(event)
    mocks.begin.mockResolvedValue(true)
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(mocks.project).toHaveBeenCalledWith(subscription, 123)
    expect(mocks.finish).toHaveBeenCalledWith("evt_1", "processed")
  })

  describe("new subscriptions", () => {
    const deliverCheckout = () => {
      mocks.construct.mockReturnValue({
        id: "evt_3", type: "checkout.session.completed", created: 7,
        data: { object: { id: "cs_2", mode: "subscription", payment_status: "paid", subscription: "sub_9" } },
      })
      mocks.begin.mockResolvedValue(true)
      mocks.retrieve.mockResolvedValue({ id: "sub_9", customer: "cus_1" })
      mocks.findUser.mockResolvedValue("user-1")
      return POST(request())
    }

    it("switches the buyer to JobClock credits", async () => {
      expect((await deliverCheckout()).status).toBe(200)
      expect(mocks.project).toHaveBeenCalledWith({ id: "sub_9", customer: "cus_1" }, 7)
      expect(mocks.useJobclock).toHaveBeenCalledWith("user-1")
    })

    it("leaves the AI source alone on later subscription updates", async () => {
      mocks.construct.mockReturnValue({ id: "evt_4", type: "customer.subscription.updated", created: 8, data: { object: { id: "sub_9" } } })
      mocks.begin.mockResolvedValue(true)
      await POST(request())
      expect(mocks.useJobclock).not.toHaveBeenCalled()
    })
  })

  describe("credit pack payments", () => {
    const session = (overrides: Record<string, unknown> = {}) => ({
      id: "cs_1", mode: "payment", payment_status: "paid", customer: "cus_1", currency: "gbp", amount_total: 400,
      metadata: { jobclock_kind: "credit_pack", jobclock_user_id: "user-1", pack: "credits_50" },
      ...overrides,
    })
    const deliver = (object: unknown) => {
      mocks.construct.mockReturnValue({ id: "evt_2", type: "checkout.session.completed", created: 5, data: { object } })
      mocks.begin.mockResolvedValue(true)
      return POST(request())
    }

    beforeEach(() => {
      mocks.findUser.mockResolvedValue("user-1")
      mocks.grant.mockResolvedValue(true)
    })

    it("grants the pack once the payment is verified", async () => {
      expect((await deliver(session())).status).toBe(200)
      expect(mocks.grant).toHaveBeenCalledWith({
        userId: "user-1", checkoutSessionId: "cs_1", pack: "credits_50", credits: 50, amountPence: 400,
      })
      expect(mocks.finish).toHaveBeenCalledWith("evt_2", "processed")
    })

    it("grants nothing for an unpaid session", async () => {
      await deliver(session({ payment_status: "unpaid" }))
      expect(mocks.grant).not.toHaveBeenCalled()
      expect(mocks.finish).toHaveBeenCalledWith("evt_2", "ignored")
    })

    it("fails the event when the paid amount does not match the pack", async () => {
      expect((await deliver(session({ amount_total: 100 }))).status).toBe(500)
      expect(mocks.grant).not.toHaveBeenCalled()
      expect(mocks.finish).toHaveBeenCalledWith("evt_2", "failed", expect.stringContaining("amount"))
    })

    it("fails the event when the customer belongs to a different user", async () => {
      mocks.findUser.mockResolvedValue("someone-else")
      expect((await deliver(session())).status).toBe(500)
      expect(mocks.grant).not.toHaveBeenCalled()
    })

    it("marks a replayed session as ignored", async () => {
      mocks.grant.mockResolvedValue(false)
      await deliver(session())
      expect(mocks.finish).toHaveBeenCalledWith("evt_2", "ignored")
    })
  })
})
