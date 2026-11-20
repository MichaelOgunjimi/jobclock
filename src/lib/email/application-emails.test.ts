import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const state = { rows: [] as unknown[] }
  // A stand-in for a drizzle query: every builder method returns itself and awaiting it gives the rows.
  const chain: Record<string, unknown> = {}
  for (const method of ["from", "innerJoin", "leftJoin", "where", "orderBy"]) chain[method] = () => chain
  chain.then = (resolve: (rows: unknown[]) => unknown) => resolve(state.rows)
  return { state, chain, sentKeys: vi.fn(), sendOptional: vi.fn() }
})
vi.mock("@/lib/db", () => ({ db: { select: () => mocks.chain } }))
vi.mock("./sent-log", () => ({ sentKeys: mocks.sentKeys }))
vi.mock("./optional", () => ({ sendOptionalEmail: mocks.sendOptional }))

import { sendFollowUpReminders } from "./application-emails"

const NOW = new Date("2026-11-20T08:00:00Z")
const due = (userId: string, id: string, extra: Record<string, unknown> = {}) => ({
  userId,
  id,
  slug: `role-${id}`,
  dueAt: new Date("2026-11-18T09:00:00Z"),
  title: "Engineer",
  company: "Acme",
  customTitle: null,
  customCompany: null,
  ...extra,
})

describe("sendFollowUpReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.sentKeys.mockResolvedValue(new Set())
    mocks.sendOptional.mockResolvedValue(true)
  })

  it("sends one grouped email per user per day and records each listed application", async () => {
    mocks.state.rows = [due("u1", "a"), due("u1", "b", { customTitle: "Custom role", customCompany: "Own Co" }), due("u2", "c")]

    expect(await sendFollowUpReminders(NOW)).toEqual({ eligible: 2, sent: 2, failed: 0 })
    expect(mocks.sendOptional).toHaveBeenCalledTimes(2)
    expect(mocks.sendOptional).toHaveBeenCalledWith(expect.objectContaining({
      userId: "u1",
      category: "follow_up_reminders",
      dedupeKey: "day:2026-11-20",
      recordKeys: ["app:a:2026-11-18T09:00:00.000Z", "app:b:2026-11-18T09:00:00.000Z"],
    }))

    const email = mocks.sendOptional.mock.calls[0][0].render("https://jobclock.dev/u?t=1")
    expect(email.subject).toBe("2 follow-ups due")
    expect(email.html).toContain("Custom role")
    expect(email.html).toContain("Own Co")
    expect(email.html).toContain("https://jobclock.dev/applications/role-a")
    expect(email.html).toContain("https://jobclock.dev/u?t=1")
  })

  it("leaves out applications that were already listed and sends nothing when none are new", async () => {
    mocks.state.rows = [due("u1", "a"), due("u1", "b"), due("u2", "c")]
    mocks.sentKeys.mockImplementation(async (userId: string) =>
      userId === "u1" ? new Set(["app:a:2026-11-18T09:00:00.000Z"]) : new Set(["app:c:2026-11-18T09:00:00.000Z"]))

    expect(await sendFollowUpReminders(NOW)).toEqual({ eligible: 2, sent: 1, failed: 0 })
    expect(mocks.sendOptional).toHaveBeenCalledTimes(1)
    expect(mocks.sendOptional.mock.calls[0][0].recordKeys).toEqual(["app:b:2026-11-18T09:00:00.000Z"])
  })

  it("counts a failing user without stopping the others", async () => {
    mocks.state.rows = [due("u1", "a"), due("u2", "b")]
    mocks.sendOptional.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(true)
    expect(await sendFollowUpReminders(NOW)).toEqual({ eligible: 2, sent: 1, failed: 1 })
  })

  it("does nothing when no opted-in user has a follow-up due", async () => {
    mocks.state.rows = []
    expect(await sendFollowUpReminders(NOW)).toEqual({ eligible: 0, sent: 0, failed: 0 })
    expect(mocks.sendOptional).not.toHaveBeenCalled()
  })
})
