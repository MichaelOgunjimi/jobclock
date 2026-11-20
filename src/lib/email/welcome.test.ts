import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ claimed: [] as unknown[], updates: [] as unknown[], send: vi.fn() }))
vi.mock("@/lib/db", () => ({
  db: {
    update: () => ({
      set: (values: unknown) => ({
        where: () => {
          mocks.updates.push(values)
          return { returning: async () => mocks.claimed, then: (r: (v: unknown) => unknown) => r(undefined) }
        },
      }),
    }),
  },
}))
vi.mock("./send", () => ({ sendEmail: mocks.send }))

import { sendWelcomeEmail } from "./welcome"
import { welcomeEmail } from "./templates"

describe("sendWelcomeEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updates.length = 0
    mocks.claimed = [{ id: "u1" }]
    mocks.send.mockResolvedValue(true)
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("sends once to a newly claimed account with a stable idempotency key", async () => {
    expect(await sendWelcomeEmail("u1", "a@example.com")).toBe(true)
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "a@example.com", subject: "Welcome to JobClock", idempotencyKey: "welcome/u1" }))
  })

  it("sends nothing when the welcome was already claimed", async () => {
    mocks.claimed = []
    expect(await sendWelcomeEmail("u1", "a@example.com")).toBe(false)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it("gives the claim back when the provider refuses, and never throws", async () => {
    mocks.send.mockResolvedValue(false)
    expect(await sendWelcomeEmail("u1", "a@example.com")).toBe(false)
    expect(mocks.updates.at(-1)).toEqual({ welcomeSentAt: null })
    mocks.send.mockRejectedValue(new Error("boom"))
    await expect(sendWelcomeEmail("u1", "a@example.com")).resolves.toBe(false)
  })

  it("skips an account with no address", async () => {
    expect(await sendWelcomeEmail("u1", undefined)).toBe(false)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it("points to email settings and has no unsubscribe footer (it is transactional)", () => {
    const { html, text } = welcomeEmail()
    expect(html).toContain("Settings under Emails")
    expect(text).toContain("Settings under Emails")
    expect(html).not.toContain("Unsubscribe")
  })
})
