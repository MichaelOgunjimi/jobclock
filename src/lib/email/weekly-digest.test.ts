import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ listOptedIn: vi.fn(), getData: vi.fn(), sendOptional: vi.fn() }))
vi.mock("./preferences", () => ({ listOptedIn: mocks.listOptedIn }))
vi.mock("@/lib/telegram/digest", () => ({ getDigestData: mocks.getData }))
vi.mock("./optional", () => ({ sendOptionalEmail: mocks.sendOptional }))

import { sendWeeklyDigests, weekKey } from "./weekly-digest"

const data = { followUps: [], stats: { byStatus: { applied: 2 }, savedThisWeek: 0, appliedThisWeek: 2 } }

describe("weekKey", () => {
  it("is the Monday of the UTC week", () => {
    expect(weekKey(new Date("2026-11-16T00:00:00Z"))).toBe("2026-11-16")
    expect(weekKey(new Date("2026-11-20T15:00:00Z"))).toBe("2026-11-16")
    expect(weekKey(new Date("2026-11-22T23:59:00Z"))).toBe("2026-11-16")
    expect(weekKey(new Date("2026-11-23T00:00:00Z"))).toBe("2026-11-23")
  })
})

describe("sendWeeklyDigests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("only looks at opted-in users, skips empty digests and counts failures without stopping", async () => {
    mocks.listOptedIn.mockResolvedValue(["u1", "u2", "u3", "u4"])
    mocks.getData.mockImplementation(async (id: string) => {
      if (id === "u2") return null
      if (id === "u3") throw new Error("db down")
      return data
    })
    mocks.sendOptional.mockResolvedValue(true)

    expect(await sendWeeklyDigests(new Date("2026-11-20T08:00:00Z"))).toEqual({ eligible: 4, sent: 2, failed: 1 })
    expect(mocks.listOptedIn).toHaveBeenCalledWith("weekly_digest")
    expect(mocks.sendOptional).toHaveBeenCalledTimes(2)
    expect(mocks.sendOptional).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", category: "weekly_digest", dedupeKey: "2026-11-16" }))
  })

  it("renders the digest with the unsubscribe link", async () => {
    mocks.listOptedIn.mockResolvedValue(["u1"])
    mocks.getData.mockResolvedValue({
      followUps: [{ title: "Dev <b>", company: "Acme", dueAt: "2026-11-10T09:00:00.000Z", url: "https://jobclock.dev/applications/dev" }],
      stats: { byStatus: { applied: 3, screening: 1, saved: 1 }, savedThisWeek: 1, appliedThisWeek: 2 },
    })
    mocks.sendOptional.mockResolvedValue(true)
    await sendWeeklyDigests()

    const email = mocks.sendOptional.mock.calls[0][0].render("https://jobclock.dev/u?t=1")
    expect(email.subject).toBe("Your weekly JobClock digest")
    expect(email.html).toContain("Dev &lt;b&gt;")
    expect(email.html).not.toContain("Dev <b>")
    expect(email.html).toContain("due 2026-11-10")
    expect(email.html).toContain("5 applications tracked. This week you saved 1 and applied to 2.")
    expect(email.html).toContain("1 of 4 sent applications got a reply (25%).")
    expect(email.html).toContain("https://jobclock.dev/u?t=1")
    expect(email.text).toContain("Unsubscribe from these emails: https://jobclock.dev/u?t=1")
  })

  it("shows follow-up due dates in the owner's timezone", async () => {
    mocks.listOptedIn.mockResolvedValue(["u1"])
    mocks.getData.mockResolvedValue({ ...data, followUps: [{ title: "Dev", company: "Acme", dueAt: "2026-11-10T23:30:00.000Z", timezone: "Asia/Tokyo", url: "https://jobclock.dev/applications/dev" }] })
    mocks.sendOptional.mockResolvedValue(true)
    await sendWeeklyDigests()

    const email = mocks.sendOptional.mock.calls[0][0].render("https://jobclock.dev/u?t=1")
    expect(email.html).toContain("due 2026-11-11")
    expect(email.text).toContain("due 2026-11-11")
  })
})
