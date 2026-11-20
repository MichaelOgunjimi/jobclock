import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ resendSend: vi.fn(), beaco: vi.fn() }))
vi.mock("resend", () => ({ Resend: class { emails = { send: mocks.resendSend } } }))
vi.mock("@/lib/beaco/client", () => ({ sendBeacoEvent: mocks.beaco }))

const email = { to: "user@example.com", subject: "Hello", html: "<p>Hi</p>", text: "Hi", idempotencyKey: "evt_1" }

// Re-import so the "log once" flag starts fresh in each test.
async function load() {
  vi.resetModules()
  return (await import("./send")).sendEmail
}

describe("sendEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("RESEND_API_KEY", "")
    vi.stubEnv("BEACO_API_KEY", "")
    vi.stubEnv("EMAIL_FROM", "")
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("sends through Resend when RESEND_API_KEY is set, even if Beaco is also configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.stubEnv("BEACO_API_KEY", "beaco_test")
    mocks.resendSend.mockResolvedValue({ data: { id: "1" }, error: null })

    expect(await (await load())(email)).toBe(true)
    expect(mocks.resendSend).toHaveBeenCalledWith(
      { from: "JobClock <hello@jobclock.dev>", to: "user@example.com", replyTo: "support@jobclock.dev", subject: "Hello", html: "<p>Hi</p>", text: "Hi" },
      { idempotencyKey: "evt_1" },
    )
    expect(mocks.beaco).not.toHaveBeenCalled()
  })

  it("lets EMAIL_FROM override the from address", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    vi.stubEnv("EMAIL_FROM", "JobClock <staging@example.com>")
    mocks.resendSend.mockResolvedValue({ data: { id: "1" }, error: null })

    await (await load())(email)
    expect(mocks.resendSend.mock.calls[0][0].from).toBe("JobClock <staging@example.com>")
  })

  it("returns false instead of throwing when Resend reports an error or rejects", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test")
    const sendEmail = await load()

    mocks.resendSend.mockResolvedValueOnce({ data: null, error: { name: "validation_error", message: "bad from" } })
    expect(await sendEmail(email)).toBe(false)

    mocks.resendSend.mockRejectedValueOnce(new Error("network down"))
    expect(await sendEmail(email)).toBe(false)
  })

  it("falls back to Beaco when only BEACO_API_KEY is set", async () => {
    vi.stubEnv("BEACO_API_KEY", "beaco_test")
    mocks.beaco.mockResolvedValue(undefined)

    expect(await (await load())(email)).toBe(true)
    expect(mocks.beaco).toHaveBeenCalledWith({
      event_type: "email.transactional",
      recipients: [{ channels: ["email"], email: "user@example.com" }],
      inline: { subject: "Hello", html: "<p>Hi</p>", text: "Hi", reply_to: "support@jobclock.dev" },
      payload: {},
      idempotency_key: "evt_1",
    })
    expect(mocks.resendSend).not.toHaveBeenCalled()
  })

  it("returns false instead of throwing when Beaco fails", async () => {
    vi.stubEnv("BEACO_API_KEY", "beaco_test")
    mocks.beaco.mockRejectedValue(new Error("Beaco event failed (500)"))

    expect(await (await load())(email)).toBe(false)
  })

  it("skips and warns only once when no provider is configured", async () => {
    const sendEmail = await load()

    expect(await sendEmail(email)).toBe(false)
    expect(await sendEmail(email)).toBe(false)
    expect(mocks.resendSend).not.toHaveBeenCalled()
    expect(mocks.beaco).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalledTimes(1)
  })
})
