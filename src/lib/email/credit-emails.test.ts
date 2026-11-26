import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const state = { rows: [] as unknown[] }
  // A stand-in for a drizzle query: every builder method returns itself and awaiting it gives the rows.
  const chain: Record<string, unknown> = {}
  for (const method of ["from", "innerJoin", "leftJoin", "where"]) chain[method] = () => chain
  chain.then = (resolve: (rows: unknown[]) => unknown) => resolve(state.rows)
  return { state, chain, sendOptional: vi.fn() }
})
vi.mock("@/lib/db", () => ({ db: { select: () => mocks.chain } }))
vi.mock("./optional", () => ({ sendOptionalEmail: mocks.sendOptional }))

import { isLowOnCredits, sendCreditsLowEmails, sendCreditsResetEmails, usedMostOfAllowance } from "./credit-emails"

const NOW = new Date("2026-11-20T08:00:00Z")
const START = new Date("2026-11-01T00:00:00Z")
const END = new Date("2026-12-01T00:00:00Z")

describe("credit thresholds", () => {
  it("is low only when under 20% remains, counting reserved credits as spent", () => {
    expect(isLowOnCredits(100, 79, 0)).toBe(false)
    expect(isLowOnCredits(100, 80, 0)).toBe(false) // exactly 20% left is not under 20%
    expect(isLowOnCredits(100, 81, 0)).toBe(true)
    expect(isLowOnCredits(100, 70, 15)).toBe(true)
    expect(isLowOnCredits(0, 0, 0)).toBe(false)
  })

  it("counts a reset only after more than half was used", () => {
    expect(usedMostOfAllowance(100, 50)).toBe(false)
    expect(usedMostOfAllowance(100, 51)).toBe(true)
    expect(usedMostOfAllowance(0, 0)).toBe(false)
  })
})

describe("sendCreditsLowEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendOptional.mockResolvedValue(true)
  })

  it("emails only users under the threshold, once per period, with what is left", async () => {
    mocks.state.rows = [
      { userId: "u1", start: START, end: END, limit: 100, used: 85, reserved: 0 },
      { userId: "u2", start: START, end: END, limit: 100, used: 30, reserved: 0 },
    ]
    expect(await sendCreditsLowEmails(NOW)).toEqual({ eligible: 1, sent: 1, failed: 0 })
    expect(mocks.sendOptional).toHaveBeenCalledTimes(1)
    expect(mocks.sendOptional).toHaveBeenCalledWith(expect.objectContaining({
      userId: "u1",
      category: "credit_alerts",
      dedupeKey: "low:2026-11-01T00:00:00.000Z",
    }))
    const email = mocks.sendOptional.mock.calls[0][0].render("https://jobclock.dev/u?t=1")
    expect(email.subject).toBe("Your JobClock credits are running low")
    expect(email.html).toContain("15 credits left of your 100 monthly credits")
    expect(email.html).toContain("2026-12-01")
    expect(email.html).toContain("https://jobclock.dev/settings?tab=billing")
    expect(email.text).toContain("Unsubscribe from these emails: https://jobclock.dev/u?t=1")
  })

  it("shows the reset date on the user's own calendar day", async () => {
    // END is a UTC instant late on 30 November; in Tokyo that is already 1 December.
    mocks.state.rows = [{ userId: "u1", start: START, end: new Date("2026-11-30T23:30:00Z"), limit: 100, used: 85, reserved: 0, timezone: "Asia/Tokyo" }]
    await sendCreditsLowEmails(NOW)
    const email = mocks.sendOptional.mock.calls[0][0].render("https://jobclock.dev/u?t=1")
    expect(email.html).toContain("reset on 2026-12-01")
  })
})

describe("sendCreditsResetEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendOptional.mockResolvedValue(true)
  })

  it("emails only users who used more than half, keyed by the finished period", async () => {
    mocks.state.rows = [
      { userId: "u1", start: START, limit: 100, used: 90 },
      { userId: "u2", start: START, limit: 100, used: 10 },
    ]
    expect(await sendCreditsResetEmails(NOW)).toEqual({ eligible: 1, sent: 1, failed: 0 })
    expect(mocks.sendOptional).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", dedupeKey: "reset:2026-11-01T00:00:00.000Z" }))
    const email = mocks.sendOptional.mock.calls[0][0].render("https://jobclock.dev/u?t=1")
    expect(email.subject).toBe("Your JobClock credits have reset")
    expect(email.html).toContain("reset to 100 credits")
  })

  it("counts a failing user without throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.state.rows = [{ userId: "u1", start: START, limit: 100, used: 90 }]
    mocks.sendOptional.mockRejectedValue(new Error("db down"))
    expect(await sendCreditsResetEmails(NOW)).toEqual({ eligible: 1, sent: 0, failed: 1 })
  })
})
