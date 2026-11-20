import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ followUps: vi.fn(), deadlines: vi.fn() }))
vi.mock("./application-emails", () => ({ sendFollowUpReminders: mocks.followUps, sendDeadlineReminders: mocks.deadlines }))

import { runDailyEmails } from "./daily-emails"

describe("runDailyEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("reports each job's result", async () => {
    mocks.followUps.mockResolvedValue({ eligible: 1, sent: 1, failed: 0 })
    mocks.deadlines.mockResolvedValue({ eligible: 0, sent: 0, failed: 0 })
    expect(await runDailyEmails(new Date("2026-11-20T08:00:00Z"))).toEqual({
      followUps: { eligible: 1, sent: 1, failed: 0 },
      deadlines: { eligible: 0, sent: 0, failed: 0 },
    })
  })

  it("keeps going and reports an error when a job throws", async () => {
    mocks.followUps.mockRejectedValue(new Error("boom"))
    mocks.deadlines.mockResolvedValue({ eligible: 1, sent: 1, failed: 0 })
    expect(await runDailyEmails()).toEqual({ followUps: { error: "failed" }, deadlines: { eligible: 1, sent: 1, failed: 0 } })
  })
})
