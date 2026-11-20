import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  getPreferences: vi.fn(),
  send: vi.fn(),
  claim: vi.fn(),
  release: vi.fn(),
  record: vi.fn(),
  link: vi.fn(),
}))
vi.mock("@/lib/db", () => ({ db: { execute: mocks.execute } }))
vi.mock("./preferences", () => ({ getEmailPreferences: mocks.getPreferences }))
vi.mock("./send", () => ({ sendEmail: mocks.send }))
vi.mock("./sent-log", () => ({ claimSend: mocks.claim, releaseSend: mocks.release, recordSent: mocks.record }))
vi.mock("./unsubscribe-token", () => ({ unsubscribeUrl: mocks.link }))

import { sendOptionalEmail } from "./optional"

const rendered = { subject: "Hi", html: "<p>Hi</p>", text: "Hi" }
const render = vi.fn((url: string) => ({ ...rendered, text: `Hi ${url}` }))
const base = { userId: "u1", category: "job_alerts", dedupeKey: "k1", render } as const

describe("sendOptionalEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPreferences.mockResolvedValue({ jobAlerts: true })
    mocks.execute.mockResolvedValue([{ email: "user@example.com" }])
    mocks.claim.mockResolvedValue(true)
    mocks.send.mockResolvedValue(true)
    mocks.link.mockReturnValue("https://jobclock.dev/api/email/unsubscribe?t=abc")
  })

  it("sends nothing to a user who has not opted in to that category", async () => {
    mocks.getPreferences.mockResolvedValue({ jobAlerts: false, weeklyDigest: true })
    expect(await sendOptionalEmail(base)).toBe(false)
    expect(mocks.claim).not.toHaveBeenCalled()
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it("sends with the unsubscribe link, one-click headers and a stable idempotency key", async () => {
    expect(await sendOptionalEmail({ ...base, recordKeys: ["a:1"] })).toBe(true)
    expect(render).toHaveBeenCalledWith("https://jobclock.dev/api/email/unsubscribe?t=abc")
    expect(mocks.send).toHaveBeenCalledWith({
      to: "user@example.com",
      ...rendered,
      text: "Hi https://jobclock.dev/api/email/unsubscribe?t=abc",
      headers: {
        "List-Unsubscribe": "<https://jobclock.dev/api/email/unsubscribe?t=abc>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      idempotencyKey: "job_alerts/u1/k1",
    })
    expect(mocks.record).toHaveBeenCalledWith("u1", "job_alerts", ["a:1"])
  })

  it("uses the address the caller already has instead of looking it up", async () => {
    await sendOptionalEmail({ ...base, to: "given@example.com" })
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "given@example.com" }))
  })

  it("does not send the same dedupe key twice", async () => {
    mocks.claim.mockResolvedValue(false)
    expect(await sendOptionalEmail(base)).toBe(false)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it("gives the dedupe slot back when the provider refuses, so the next run retries", async () => {
    mocks.send.mockResolvedValue(false)
    expect(await sendOptionalEmail({ ...base, recordKeys: ["a:1"] })).toBe(false)
    expect(mocks.release).toHaveBeenCalledWith("u1", "job_alerts", "k1")
    expect(mocks.record).not.toHaveBeenCalled()
  })

  it("does not send an email that cannot carry a signed unsubscribe link", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.link.mockImplementation(() => {
      throw new Error("ENCRYPTION_SECRET is required")
    })
    expect(await sendOptionalEmail(base)).toBe(false)
    expect(mocks.claim).not.toHaveBeenCalled()
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it("skips a user with no email address", async () => {
    mocks.execute.mockResolvedValue([])
    expect(await sendOptionalEmail(base)).toBe(false)
    expect(mocks.send).not.toHaveBeenCalled()
  })
})
