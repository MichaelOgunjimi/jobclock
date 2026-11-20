import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ disable: vi.fn() }))
vi.mock("@/lib/email/preferences", () => ({ disableEmails: mocks.disable }))

import { signUnsubscribeToken } from "@/lib/email/unsubscribe-token"
import { GET, POST } from "./route"

const USER = "3f8f6f1e-8a0b-4c1c-9d55-0d9a4b7d2a10"
const url = (token: string) => `https://jobclock.dev/api/email/unsubscribe?t=${encodeURIComponent(token)}`

describe("unsubscribe route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("ENCRYPTION_SECRET", "test-secret")
    mocks.disable.mockResolvedValue(undefined)
  })
  afterEach(() => vi.unstubAllEnvs())

  it("turns off just the category in the link and shows a confirmation without needing a login", async () => {
    const res = await GET(new Request(url(signUnsubscribeToken(USER, "weekly_digest"))))
    expect(res.status).toBe(200)
    expect(mocks.disable).toHaveBeenCalledWith(USER, "weekly_digest")
    const html = await res.text()
    expect(html).toContain("You are unsubscribed")
    expect(html).toContain("weekly digest emails")
    expect(html).toContain("Unsubscribe from all optional JobClock emails")
  })

  it("turns off every optional email for an all link, without offering it again", async () => {
    const res = await GET(new Request(url(signUnsubscribeToken(USER, "all"))))
    expect(mocks.disable).toHaveBeenCalledWith(USER, "all")
    expect(await res.text()).not.toContain("Unsubscribe from all")
  })

  it("rejects a link that was changed and changes nothing", async () => {
    const res = await GET(new Request(url(`${signUnsubscribeToken(USER, "job_alerts")}x`)))
    expect(res.status).toBe(400)
    expect(mocks.disable).not.toHaveBeenCalled()
  })

  it("handles the one-click POST from a mail client", async () => {
    const res = await POST(new Request(url(signUnsubscribeToken(USER, "job_alerts")), { method: "POST", body: "List-Unsubscribe=One-Click" }))
    expect(res.status).toBe(200)
    expect(mocks.disable).toHaveBeenCalledWith(USER, "job_alerts")
    expect((await POST(new Request(url("nope"), { method: "POST" }))).status).toBe(400)
  })

  it("reports a failure instead of claiming success", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.disable.mockRejectedValue(new Error("db down"))
    const res = await GET(new Request(url(signUnsubscribeToken(USER, "job_alerts"))))
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain("You are unsubscribed")
  })
})
