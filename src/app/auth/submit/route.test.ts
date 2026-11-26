import { beforeEach, describe, expect, it, vi } from "vitest"

const { signUp, resend, authCodeResendLimit } = vi.hoisted(() => ({
  signUp: vi.fn(),
  resend: vi.fn(),
  authCodeResendLimit: { limit: vi.fn() },
}))

vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { signUp, resend } }) }))
vi.mock("@/lib/rate-limit", () => ({ authCodeResendLimit }))
vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig: () => ({ url: "http://supabase.test", anonKey: "anon" }),
  getSupabaseSetupHint: () => "setup",
}))

import { POST } from "./route"

const post = (fields: Record<string, string>) => {
  const body = new FormData()
  Object.entries(fields).forEach(([k, v]) => body.set(k, v))
  return POST(new Request("http://localhost/auth/submit", { method: "POST", body }) as never)
}

describe("POST /auth/submit code step", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authCodeResendLimit.limit.mockResolvedValue({ success: true })
    resend.mockResolvedValue({ error: null })
  })

  it("asks the page for the code step when signup needs confirmation", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null })
    expect(await (await post({ intent: "signup", email: "a@b.co", password: "secret1" })).json()).toMatchObject({ ok: true, needsCode: true })
  })

  it("skips the code step when signup returns a session", async () => {
    signUp.mockResolvedValue({ data: { session: { access_token: "jwt" } }, error: null })
    expect(await (await post({ intent: "signup", email: "a@b.co", password: "secret1", next: "/x" })).json()).toEqual({ ok: true, redirect: "/x" })
  })

  it("resends a signup code without needing a password", async () => {
    const body = await (await post({ intent: "resend_code", email: "a@b.co" })).json()
    expect(resend).toHaveBeenCalledWith(expect.objectContaining({ type: "signup", email: "a@b.co" }))
    expect(body.ok).toBe(true)
  })

  it("answers the same when Supabase refuses the resend, so no email is revealed", async () => {
    const ok = await (await post({ intent: "resend_code", email: "a@b.co" })).json()
    resend.mockResolvedValue({ error: { status: 400, message: "User not found" } })
    expect(await (await post({ intent: "resend_code", email: "nobody@b.co" })).json()).toEqual(ok)
  })

  it("does not resend when rate limited", async () => {
    authCodeResendLimit.limit.mockResolvedValue({ success: false })
    expect(await (await post({ intent: "resend_code", email: "a@b.co" })).json()).toMatchObject({ ok: false })
    expect(resend).not.toHaveBeenCalled()
  })
})
