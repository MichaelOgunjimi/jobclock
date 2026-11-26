import { beforeEach, describe, expect, it, vi } from "vitest"

const { verifyOtp, sendWelcomeEmail, authCodeVerifyLimit, cookieSetter } = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  authCodeVerifyLimit: { limit: vi.fn() },
  cookieSetter: { value: null as null | ((c: Array<{ name: string; value: string; options: object }>) => void) },
}))

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: { setAll: NonNullable<typeof cookieSetter.value> } }) => {
    cookieSetter.value = opts.cookies.setAll
    return { auth: { verifyOtp } }
  },
}))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => void task(),
}))
vi.mock("@/lib/email/welcome", () => ({ sendWelcomeEmail }))
vi.mock("@/lib/rate-limit", () => ({ authCodeVerifyLimit }))
vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig: () => ({ url: "http://supabase.test", anonKey: "anon" }),
  getSupabaseSetupHint: () => "setup",
}))

import { POST } from "./route"

const post = (fields: Record<string, string>, headers: Record<string, string> = {}) => {
  const body = new FormData()
  Object.entries(fields).forEach(([k, v]) => body.set(k, v))
  return POST(new Request("http://localhost/auth/verify-code", { method: "POST", body, headers }) as never)
}

const GOOD = { email: "ada@example.com", code: "123456" }

describe("POST /auth/verify-code", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authCodeVerifyLimit.limit.mockResolvedValue({ success: true })
    verifyOtp.mockImplementation(async () => {
      cookieSetter.value?.([{ name: "sb-session", value: "jwt", options: { path: "/" } }])
      return { data: { user: { id: "u1", email: "ada@example.com" }, session: { access_token: "jwt" } }, error: null }
    })
  })

  it("confirms with a valid code, sets the session cookie, sends the welcome email and redirects to next", async () => {
    const res = await post({ ...GOOD, next: "/applications/7" })

    expect(verifyOtp).toHaveBeenCalledWith({ email: "ada@example.com", token: "123456", type: "signup" })
    expect(await res.json()).toEqual({ ok: true, redirect: "/applications/7" })
    expect(res.cookies.get("sb-session")?.value).toBe("jwt")
    expect(sendWelcomeEmail).toHaveBeenCalledWith("u1", "ada@example.com")
  })

  it("accepts a pasted code with spaces", async () => {
    await post({ ...GOOD, code: "123 456" })
    expect(verifyOtp).toHaveBeenCalledWith(expect.objectContaining({ token: "123456" }))
  })

  it("gives one message for a wrong, expired or unknown-email code and sets no cookie", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: { status: 403, message: "Token has expired or is invalid" } })
    const res = await post(GOOD)
    const body = await res.json()

    expect(body).toMatchObject({ ok: false, message: expect.stringMatching(/wrong or has expired/) })
    expect(res.cookies.getAll()).toHaveLength(0)
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  it("rejects a code that is not six digits without calling Supabase", async () => {
    for (const code of ["12345", "1234567", "12ab56", ""]) {
      expect(await (await post({ ...GOOD, code })).json()).toMatchObject({ ok: false })
    }
    expect(verifyOtp).not.toHaveBeenCalled()
  })

  it("returns 429 and never verifies when rate limited", async () => {
    authCodeVerifyLimit.limit.mockResolvedValue({ success: false })
    const res = await post(GOOD, { "x-forwarded-for": "203.0.113.9, 10.0.0.1" })

    expect(res.status).toBe(429)
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(authCodeVerifyLimit.limit).toHaveBeenCalledWith("ip:203.0.113.9")
    expect(authCodeVerifyLimit.limit).toHaveBeenCalledWith("email:ada@example.com")
  })

  it.each(["https://evil.com", "//evil.com", "javascript:alert(1)", ""])("falls back to /dashboard for next=%j", async (next) => {
    expect(await (await post({ ...GOOD, next })).json()).toEqual({ ok: true, redirect: "/dashboard" })
  })
})
