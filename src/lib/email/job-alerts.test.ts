import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PersistedJobInput } from "@/lib/jobs/persist-job"

const mocks = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock("./send", () => ({ sendEmail: mocks.send }))

import { sendNewJobAlerts } from "./job-alerts"

const jobs = [{ title: "Engineer", company: "Acme", location: "London", url: "https://acme.example/1" }] as PersistedJobInput[]

describe("sendNewJobAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://jobclock.dev")
  })
  afterEach(() => vi.unstubAllEnvs())

  it("sends nothing unless JOB_ALERT_EMAILS_ENABLED is true", async () => {
    vi.stubEnv("JOB_ALERT_EMAILS_ENABLED", "")
    await sendNewJobAlerts("user@example.com", "u1", jobs)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it("skips an empty address or an empty job list", async () => {
    vi.stubEnv("JOB_ALERT_EMAILS_ENABLED", "true")
    await sendNewJobAlerts("", "u1", jobs)
    await sendNewJobAlerts("user@example.com", "u1", [])
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it("sends one rendered digest with an hourly idempotency key when enabled", async () => {
    vi.stubEnv("JOB_ALERT_EMAILS_ENABLED", "true")
    await sendNewJobAlerts("user@example.com", "u1", jobs)
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "user@example.com",
      subject: "1 new job at the companies you track",
      idempotencyKey: expect.stringMatching(/^job-alert-digest\/u1\/\d{4}-\d{2}-\d{2}T\d{2}$/),
    }))
  })
})
