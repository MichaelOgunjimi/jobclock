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

import { interviewWindow, sendDeadlineReminders, sendFollowUpReminders, sendInterviewReminders, sendStaleApplicationNudges } from "./application-emails"

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

  it("shows the due date on the user's own calendar day", async () => {
    mocks.state.rows = [due("u1", "a", { dueAt: new Date("2026-11-18T23:30:00Z"), timezone: "Asia/Tokyo" })]
    await sendFollowUpReminders(NOW)
    const email = mocks.sendOptional.mock.calls[0][0].render("https://jobclock.dev/u?t=1")
    expect(email.html).toContain("due 2026-11-19")
    expect(email.text).toContain("due 2026-11-19")
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

  it("counts the days on the recipient's own calendar, not UTC's", async () => {
    // 08:00 UTC on 20 Nov is 22:00 on 19 Nov in Hawaii: the 21st is two days away there, the 22nd three.
    mocks.state.rows = [
      job("u1", "j1", "2026-11-22", { timezone: "Pacific/Honolulu" }),
      job("u1", "j2", "2026-11-21", { timezone: "Pacific/Honolulu" }),
      job("u2", "j3", "2026-11-22", { timezone: "Europe/London" }),
      job("u3", "j4", "2026-11-20", { timezone: "Pacific/Honolulu" }),
    ]
    await sendDeadlineReminders(NOW)
    expect(mocks.sendOptional.mock.calls.map(([call]) => call.dedupeKey)).toEqual(["job:j2", "job:j3", "job:j4"])
    expect(mocks.sendOptional.mock.calls[0][0].render("u").subject).toBe("Applications for Engineer <b> close in 2 days")
    expect(mocks.sendOptional.mock.calls[2][0].render("u").subject).toBe("Applications for Engineer <b> close tomorrow")
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
    expect(email.html).toContain("2026-11-21 14:30 GMT")
    expect(email.html).toContain("Open interview prep")
    expect(email.html).toContain("https://jobclock.dev/applications/role-a")
  })

  // Runs the job at `now` for one interview and returns the rendered email, or null when it was left out.
  const remind = async (now: string, interviewAt: string, timezone?: string | null) => {
    vi.clearAllMocks()
    mocks.sendOptional.mockResolvedValue(true)
    mocks.state.rows = [interview("u1", "a", { interviewAt: new Date(interviewAt), timezone })]
    await sendInterviewReminders(new Date(now))
    return mocks.sendOptional.mock.calls[0]?.[0].render("https://jobclock.dev/u?t=1").html as string | undefined ?? null
  }

  it("shows the time in the recipient's timezone, across the clock change", async () => {
    expect(await remind("2026-11-20T08:00:00Z", "2026-11-21T14:30:00Z", "America/New_York")).toContain("2026-11-21 09:30 EST")
    // 00:30 UTC on the morning the UK clocks go forward is still GMT; an hour later it is BST.
    expect(await remind("2026-03-28T08:00:00Z", "2026-03-29T01:30:00Z", "Europe/London")).toContain("2026-03-29 02:30 BST")
    expect(await remind("2026-07-01T08:00:00Z", "2026-07-02T13:00:00Z", "Asia/Tokyo")).toContain("2026-07-02 22:00 GMT+9")
  })

  it("falls back to Europe/London when the user has no stored timezone", async () => {
    for (const timezone of [null, "Bad/Zone"]) {
      expect(await remind("2026-07-01T08:00:00Z", "2026-07-02T13:00:00Z", timezone)).toContain("2026-07-02 14:00 BST")
      // 23:30 UTC on the 1st is 00:30 BST on the 2nd: tomorrow in London, though still today in UTC.
      expect(await remind("2026-07-01T08:00:00Z", "2026-07-01T23:30:00Z", timezone)).not.toBeNull()
      expect(await remind("2026-07-01T08:00:00Z", "2026-07-02T23:30:00Z", timezone)).toBeNull()
    }
  })

  // [zone, run time, interview instant, is it tomorrow for that user?]
  it.each([
    // UK winter (GMT = UTC): local day is the UTC day.
    ["Europe/London", "2026-11-20T08:00:00Z", "2026-11-21T00:30:00Z", true],
    ["Europe/London", "2026-11-20T08:00:00Z", "2026-11-21T23:30:00Z", true],
    ["Europe/London", "2026-11-20T08:00:00Z", "2026-11-20T23:30:00Z", false],
    ["Europe/London", "2026-11-20T08:00:00Z", "2026-11-22T00:30:00Z", false],
    // UK summer (BST = UTC+1): 00:30 on the 2nd is 23:30 UTC on the 1st, 00:30 on the 3rd is 23:30 UTC on the 2nd.
    ["Europe/London", "2026-07-01T08:00:00Z", "2026-07-01T23:30:00Z", true],
    ["Europe/London", "2026-07-01T08:00:00Z", "2026-07-02T22:30:00Z", true],
    ["Europe/London", "2026-07-01T08:00:00Z", "2026-07-02T23:30:00Z", false],
    ["Europe/London", "2026-07-01T08:00:00Z", "2026-07-01T22:30:00Z", false],
    // Tokyo (UTC+9): 08:00 UTC is 17:00 on the 1st; tomorrow is 15:00 UTC on the 1st to 15:00 UTC on the 2nd.
    ["Asia/Tokyo", "2026-07-01T08:00:00Z", "2026-07-01T15:30:00Z", true],
    ["Asia/Tokyo", "2026-07-01T08:00:00Z", "2026-07-02T14:30:00Z", true],
    ["Asia/Tokyo", "2026-07-01T08:00:00Z", "2026-07-02T15:30:00Z", false],
    ["Asia/Tokyo", "2026-07-01T08:00:00Z", "2026-07-01T14:30:00Z", false],
    // New York (EDT, UTC-4): 08:00 UTC is 04:00 on the 1st; tomorrow is 04:00 UTC on the 2nd to 04:00 UTC on the 3rd.
    ["America/New_York", "2026-07-01T08:00:00Z", "2026-07-02T04:30:00Z", true],
    ["America/New_York", "2026-07-01T08:00:00Z", "2026-07-03T03:30:00Z", true],
    ["America/New_York", "2026-07-01T08:00:00Z", "2026-07-02T03:30:00Z", false],
    ["America/New_York", "2026-07-01T08:00:00Z", "2026-07-03T04:30:00Z", false],
    // UK clocks go forward on 29 Mar (23-hour day, 00:00Z to 23:00Z): 23:30 BST is in, 00:30 BST on the 30th is out.
    ["Europe/London", "2026-03-28T08:00:00Z", "2026-03-29T22:30:00Z", true],
    ["Europe/London", "2026-03-28T08:00:00Z", "2026-03-29T23:30:00Z", false],
    // UK clocks go back on 25 Oct (25-hour day, 23:00Z on the 24th to 24:00Z): 23:30 GMT is in, 00:30 GMT on the 26th is out.
    ["Europe/London", "2026-10-24T08:00:00Z", "2026-10-25T23:30:00Z", true],
    ["Europe/London", "2026-10-24T08:00:00Z", "2026-10-26T00:30:00Z", false],
    ["Europe/London", "2026-10-24T08:00:00Z", "2026-10-24T22:30:00Z", false],
  ] as const)("%s run at %s: interview at %s is tomorrow = %s", async (zone, now, at, expected) => {
    expect((await remind(now, at, zone)) !== null).toBe(expected)
  })

  it("never skips or repeats an interview across daily runs, including the days the clocks change", () => {
    const zones = ["Europe/London", "America/New_York", "America/Anchorage", "Pacific/Honolulu", "Asia/Tokyo", "Pacific/Kiritimati", "Australia/Lord_Howe", "America/Havana"]
    for (const zone of zones) {
      // Daily 08:00 UTC runs through both clock changes for the northern and southern zones.
      for (const [start, days] of [["2026-02-25", 60], ["2026-10-01", 70], ["2026-03-25", 20]] as const) {
        let previousTo: Date | null = null
        for (let i = 0; i < days; i += 1) {
          const run = new Date(Date.parse(`${start}T08:00:00Z`) + i * 86_400_000)
          const { from, to } = interviewWindow(run, zone)
          expect(from.getTime(), `${zone} ${run.toISOString()}`).toBeLessThanOrEqual(to.getTime())
          if (previousTo) expect(from.toISOString(), `${zone} ${run.toISOString()}`).toBe(previousTo.toISOString())
          previousTo = to
        }
      }
    }
  })

  it("covers the local day a daylight-saving jump would otherwise skip", () => {
    // Alaska runs at 23:00 on 7 Mar and 00:00 on 9 Mar: 8 Mar would never be "tomorrow" without the catch-up.
    const sat = interviewWindow(new Date("2026-03-07T08:00:00Z"), "America/Anchorage")
    const mon = interviewWindow(new Date("2026-03-09T08:00:00Z"), "America/Anchorage")
    const sun = interviewWindow(new Date("2026-03-08T08:00:00Z"), "America/Anchorage")
    expect(sun.from.toISOString()).toBe(sat.to.toISOString())
    expect(mon.from.toISOString()).toBe(sun.to.toISOString())
    expect(interviewWindow(new Date("2026-03-10T08:00:00Z"), "America/Anchorage").from.toISOString()).toBe(mon.to.toISOString())
  })

  it("does nothing when no opted-in user has an interview tomorrow", async () => {
    mocks.state.rows = []
    expect(await sendInterviewReminders(NOW)).toEqual({ eligible: 0, sent: 0, failed: 0 })
  })
})

describe("sendStaleApplicationNudges", () => {
  const stale = (userId: string, id: string, extra: Record<string, unknown> = {}) => ({
    userId,
    id,
    slug: `role-${id}`,
    changedAt: new Date("2026-10-25T08:00:00Z"),
    title: "Engineer",
    company: "Acme",
    customTitle: null,
    customCompany: null,
    ...extra,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sentKeys.mockResolvedValue(new Set())
    mocks.sendOptional.mockResolvedValue(true)
  })

  it("nudges each application once ever: its plain application key is recorded and never listed again", async () => {
    mocks.state.rows = [stale("u1", "a"), stale("u1", "b")]
    mocks.sentKeys.mockResolvedValue(new Set(["app:a"]))

    expect(await sendStaleApplicationNudges(NOW)).toEqual({ eligible: 1, sent: 1, failed: 0 })
    expect(mocks.sendOptional).toHaveBeenCalledWith(expect.objectContaining({
      userId: "u1",
      category: "stale_application_nudges",
      dedupeKey: "day:2026-11-20",
      recordKeys: ["app:b"],
    }))
    const email = mocks.sendOptional.mock.calls[0][0].render("https://jobclock.dev/u?t=1")
    expect(email.subject).toBe("An application has gone quiet")
    expect(email.html).toContain("no change for 26 days")
    expect(email.html).toContain("mark them as ghosted")
  })

  it("sends nothing when every stale application was already nudged", async () => {
    mocks.state.rows = [stale("u1", "a")]
    mocks.sentKeys.mockResolvedValue(new Set(["app:a"]))
    expect(await sendStaleApplicationNudges(NOW)).toEqual({ eligible: 1, sent: 0, failed: 0 })
    expect(mocks.sendOptional).not.toHaveBeenCalled()
  })

  it("groups several applications into one email", async () => {
    mocks.state.rows = [stale("u1", "a"), stale("u1", "b", { customTitle: "<i>Own</i>" })]
    await sendStaleApplicationNudges(NOW)
    expect(mocks.sendOptional).toHaveBeenCalledTimes(1)
    const email = mocks.sendOptional.mock.calls[0][0].render("u")
    expect(email.subject).toBe("2 applications have gone quiet")
    expect(email.html).toContain("&lt;i&gt;Own&lt;/i&gt;")
  })
})
