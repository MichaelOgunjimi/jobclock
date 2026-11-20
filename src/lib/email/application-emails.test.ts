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

import { sendDeadlineReminders, sendFollowUpReminders, sendInterviewReminders } from "./application-emails"

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

describe("sendDeadlineReminders", () => {
  const job = (userId: string, jobId: string, deadline: string, extra: Record<string, unknown> = {}) => ({
    userId,
    jobId,
    slug: `role-${jobId}`,
    deadline,
    title: "Engineer <b>",
    company: "Acme",
    customTitle: null,
    customCompany: null,
    ...extra,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendOptional.mockResolvedValue(true)
  })

  it("sends one email per job, keyed by the job, so a job is never reminded twice", async () => {
    mocks.state.rows = [job("u1", "j1", "2026-11-22"), job("u1", "j2", "2026-11-21"), job("u2", "j3", "2026-11-22")]

    expect(await sendDeadlineReminders(NOW)).toEqual({ eligible: 2, sent: 3, failed: 0 })
    expect(mocks.sendOptional).toHaveBeenCalledTimes(3)
    expect(mocks.sendOptional).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", category: "deadline_reminders", dedupeKey: "job:j1" }))
    expect(mocks.sendOptional).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", dedupeKey: "job:j2" }))
  })

  it("words the email by how many days are left and escapes the title", async () => {
    mocks.state.rows = [job("u1", "j1", "2026-11-22"), job("u1", "j2", "2026-11-21")]
    await sendDeadlineReminders(NOW)

    const twoDays = mocks.sendOptional.mock.calls[0][0].render("https://jobclock.dev/u?t=1")
    expect(twoDays.subject).toBe("Applications for Engineer <b> close in 2 days")
    expect(twoDays.html).toContain("Engineer &lt;b&gt;")
    expect(twoDays.html).not.toContain("Engineer <b>")
    expect(twoDays.html).toContain("closes 2026-11-22")
    expect(twoDays.html).toContain("https://jobclock.dev/applications/role-j1")
    expect(mocks.sendOptional.mock.calls[1][0].render("u").subject).toBe("Applications for Engineer <b> close tomorrow")
  })

  it("does not count an email the opt-in sender declined", async () => {
    mocks.state.rows = [job("u1", "j1", "2026-11-22")]
    mocks.sendOptional.mockResolvedValue(false)
    expect(await sendDeadlineReminders(NOW)).toEqual({ eligible: 1, sent: 0, failed: 0 })
  })
})

describe("sendInterviewReminders", () => {
  const interview = (userId: string, id: string, extra: Record<string, unknown> = {}) => ({
    userId,
    id,
    slug: `role-${id}`,
    interviewAt: new Date("2026-11-21T14:30:00Z"),
    title: "Engineer",
    company: "Acme & Co",
    customTitle: null,
    customCompany: null,
    ...extra,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sendOptional.mockResolvedValue(true)
  })

  it("sends one email per interview, keyed by application and time, linking to the application", async () => {
    mocks.state.rows = [interview("u1", "a"), interview("u2", "b")]

    expect(await sendInterviewReminders(NOW)).toEqual({ eligible: 2, sent: 2, failed: 0 })
    expect(mocks.sendOptional).toHaveBeenCalledWith(expect.objectContaining({
      userId: "u1",
      category: "interview_reminders",
      dedupeKey: "app:a:2026-11-21T14:30:00.000Z",
    }))
    const email = mocks.sendOptional.mock.calls[0][0].render("https://jobclock.dev/u?t=1")
    expect(email.subject).toBe("Interview tomorrow: Engineer at Acme & Co")
    expect(email.html).toContain("Acme &amp; Co")
    expect(email.html).toContain("2026-11-21 14:30 UTC")
    expect(email.html).toContain("Open interview prep")
    expect(email.html).toContain("https://jobclock.dev/applications/role-a")
  })

  it("does nothing when no opted-in user has an interview tomorrow", async () => {
    mocks.state.rows = []
    expect(await sendInterviewReminders(NOW)).toEqual({ eligible: 0, sent: 0, failed: 0 })
  })
})
