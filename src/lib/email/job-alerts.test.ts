import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PersistedJobInput } from "@/lib/jobs/persist-job"

const mocks = vi.hoisted(() => ({ sendOptional: vi.fn() }))
vi.mock("./optional", () => ({ sendOptionalEmail: mocks.sendOptional }))

import { sendNewJobAlerts } from "./job-alerts"

const jobs = [{ title: "Engineer", company: "Acme", location: "London", url: "https://acme.example/1" }] as PersistedJobInput[]

describe("sendNewJobAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://jobclock.dev")
  })

  it("skips an empty address or an empty job list", async () => {
    await sendNewJobAlerts("", "u1", jobs)
    await sendNewJobAlerts("user@example.com", "u1", [])
    expect(mocks.sendOptional).not.toHaveBeenCalled()
  })

  it("hands one digest to the opt-in sender, with an hourly dedupe key and the unsubscribe link", async () => {
    await sendNewJobAlerts("user@example.com", "u1", jobs)
    expect(mocks.sendOptional).toHaveBeenCalledWith(expect.objectContaining({
      userId: "u1",
      category: "job_alerts",
      to: "user@example.com",
      dedupeKey: expect.stringMatching(/^hour:\d{4}-\d{2}-\d{2}T\d{2}$/),
    }))
    const email = mocks.sendOptional.mock.calls[0][0].render("https://jobclock.dev/api/email/unsubscribe?t=abc")
    expect(email.subject).toBe("1 new job at the companies you track")
    expect(email.html).toContain("https://jobclock.dev/api/email/unsubscribe?t=abc")
  })
})
