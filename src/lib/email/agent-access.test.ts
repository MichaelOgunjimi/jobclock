import { beforeEach, describe, expect, it, vi } from "vitest"

const send = vi.hoisted(() => vi.fn())
vi.mock("./send", () => ({ sendEmail: send }))

import { sendAgentAccessNotice } from "./agent-access"
import { agentAccessEmail } from "./templates"

describe("sendAgentAccessNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    send.mockResolvedValue(true)
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  it("tells the owner what was created, its access and when it ends, with an idempotency key", async () => {
    const expiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString()
    expect(await sendAgentAccessNotice("me@example.com", { kind: "token", name: "Laptop", scopes: ["applications:read"], expiresAt, idempotencyKey: "agent-token/1" })).toBe(true)
    const email = send.mock.calls[0][0]
    expect(email).toMatchObject({ to: "me@example.com", subject: "A new access token was created for your JobClock account", idempotencyKey: "agent-token/1" })
    expect(email.text).toContain('an access token named "Laptop"')
    expect(email.text).toContain("read only")
    expect(email.text).toMatch(/Expires .* \(in 90 days\)/)
    expect(email.text).toContain("https://jobclock.dev/settings?tab=agent")
  })

  it("says when something never expires or stays until revoked", async () => {
    await sendAgentAccessNotice("me@example.com", { kind: "token", name: "T", scopes: ["applications:read", "applications:write"], expiresAt: null })
    expect(send.mock.calls[0][0].text).toContain("read and change")
    expect(send.mock.calls[0][0].text).toContain("It never expires")
    await sendAgentAccessNotice("me@example.com", { kind: "app", name: "Claude", scopes: ["applications:read"], expiresAt: null })
    expect(send.mock.calls[1][0].subject).toBe("An app was connected to your JobClock account")
    expect(send.mock.calls[1][0].text).toContain("It stays connected until you revoke it")
  })

  it("escapes an app name in the HTML and keeps it on one line", async () => {
    await sendAgentAccessNotice("me@example.com", { kind: "app", name: "<script>alert(1)</script>\nEvil", scopes: ["applications:read"], expiresAt: null })
    const email = send.mock.calls[0][0]
    expect(email.html).not.toContain("<script>")
    expect(email.html).toContain("&lt;script&gt;")
    expect(email.text).toContain('the app "<script>alert(1)</script> Evil"')
  })

  it("is transactional: no unsubscribe footer, and it never contains a token", () => {
    const { html, text } = agentAccessEmail({ kind: "token", name: "T", access: "read only", expires: "It never expires" })
    expect(html).not.toContain("Unsubscribe")
    expect(text).not.toContain("Unsubscribe")
    expect(`${html}${text}`).not.toMatch(/jc_[A-Za-z0-9_-]{10}/)
  })

  it("does nothing without an address, and never throws", async () => {
    expect(await sendAgentAccessNotice(undefined, { kind: "token", name: "T", scopes: [], expiresAt: null })).toBe(false)
    expect(send).not.toHaveBeenCalled()
    send.mockRejectedValue(new Error("boom"))
    await expect(sendAgentAccessNotice("me@example.com", { kind: "token", name: "T", scopes: [], expiresAt: null })).resolves.toBe(false)
  })
})
