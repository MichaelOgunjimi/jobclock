import { createServerClient } from "@supabase/ssr"
import { after, NextResponse, type NextRequest } from "next/server"
import { sendWelcomeEmail } from "@/lib/email/welcome"
import { authCodeVerifyLimit } from "@/lib/rate-limit"
import { getSupabaseConfig, getSupabaseSetupHint } from "@/lib/supabase/config"
import type { Database } from "@/lib/supabase/database.types"

type Result = { ok: true; redirect: string } | { ok: false; message: string }

// One message for an unknown email, a wrong code and an expired one, so nothing here says which emails are registered.
const BAD_CODE = "That code is wrong or has expired. Check it, or request a new one."

/** Confirms a new account from the six-digit code in the signup email, then signs the user in. */
export async function POST(request: NextRequest) {
  const config = getSupabaseConfig()
  if (!config) return NextResponse.json<Result>({ ok: false, message: getSupabaseSetupHint() })

  const formData = await request.formData()
  const email = String(formData.get("email") ?? "").trim()
  const token = String(formData.get("code") ?? "").replace(/\s/g, "")
  const rawNext = String(formData.get("next") ?? "/dashboard")
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard"

  if (!email) return NextResponse.json<Result>({ ok: false, message: "Enter your email address." })
  if (!/^\d{6}$/.test(token)) return NextResponse.json<Result>({ ok: false, message: "Enter the 6-digit code from your email." })

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const [byIp, byEmail] = await Promise.all([
    authCodeVerifyLimit.limit(`ip:${ip}`),
    authCodeVerifyLimit.limit(`email:${email.toLowerCase()}`),
  ])
  if (!byIp.success || !byEmail.success) {
    return NextResponse.json<Result>({ ok: false, message: "Too many attempts. Wait a minute and try again." }, { status: 429, headers: { "Retry-After": "60" } })
  }

  const pendingCookies: Array<{ name: string; value: string; options: object }> = []
  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        pendingCookies.push(...cookiesToSet)
      },
    },
  })

  // Supabase checks the code, so the browser's say-so is never trusted; the session cookies below come from this call only.
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "signup" })
  if (error || !data.user || !data.session) {
    if (error) console.error("[auth/verify-code] error:", error.status, error.message)
    return NextResponse.json<Result>({ ok: false, message: BAD_CODE })
  }

  const user = data.user
  after(() => sendWelcomeEmail(user.id, user.email))

  const res = NextResponse.json<Result>({ ok: true, redirect: next })
  pendingCookies.forEach(({ name, value, options }) =>
    res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2])
  )
  return res
}
