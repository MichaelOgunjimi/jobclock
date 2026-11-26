import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseConfig, getSupabaseSetupHint } from "@/lib/supabase/config"
import type { Database } from "@/lib/supabase/database.types"
import { authCodeResendLimit } from "@/lib/rate-limit"

type Result =
  | { ok: true; redirect: string }
  | { ok: true; message: string; needsCode?: true }
  | { ok: false; message: string }

function json(data: Result, cookies: Array<{ name: string; value: string; options: object }> = []) {
  const res = NextResponse.json(data)
  cookies.forEach(({ name, value, options }) =>
    res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2])
  )
  return res
}

export async function POST(request: NextRequest) {
  const config = getSupabaseConfig()

  if (!config) {
    return json({ ok: false, message: getSupabaseSetupHint() })
  }

  const formData = await request.formData()
  const intent = String(formData.get("intent") ?? "signin")
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const rawNext = String(formData.get("next") ?? "/dashboard")
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard"
  const origin = new URL(request.url).origin

  if (!email) {
    return json({ ok: false, message: "Enter your email address." })
  }

  if (intent !== "magic_link" && intent !== "forgot_password" && intent !== "resend_code" && !password) {
    return json({ ok: false, message: "Enter your password." })
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

  if (intent === "signin") {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error("[auth/signin] error:", error.status, error.message)
      return json({ ok: false, message: "Invalid email or password." }, pendingCookies)
    }
    return json({ ok: true, redirect: next }, pendingCookies)
  }

  if (intent === "signup") {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (error) {
      console.error("[auth/signup] error:", error.status, error.message)
      return json({ ok: false, message: "Could not create account. Please try again." })
    }
    if (data.session) {
      return json({ ok: true, redirect: next }, pendingCookies)
    }
    // A registered email also lands here (Supabase hides it), so the code step must read the same either way.
    return json({ ok: true, message: "Enter the 6-digit code we sent to your email.", needsCode: true }, pendingCookies)
  }

  if (intent === "resend_code") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const [byIp, byEmail] = await Promise.all([
      authCodeResendLimit.limit(`ip:${ip}`),
      authCodeResendLimit.limit(`email:${email.toLowerCase()}`),
    ])
    if (!byIp.success || !byEmail.success) {
      return json({ ok: false, message: "Too many requests. Wait a minute and try again." })
    }
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (error) console.error("[auth/resend_code] error:", error.status, error.message)
    // Same answer for an unknown, confirmed or failing address, so this cannot reveal which emails are registered.
    return json({ ok: true, message: "If that email is waiting for confirmation, we sent a new code." })
  }

  if (intent === "magic_link") {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (error) {
      console.error("[auth/magic_link] error:", error.status, error.message)
      return json({ ok: false, message: error.message }, pendingCookies)
    }
    return json({ ok: true, message: "Magic link sent. Check your inbox." }, pendingCookies)
  }

  if (intent === "forgot_password") {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
    })
    if (error) {
      console.error("[auth/forgot_password] error:", error.status, error.message)
      return json({ ok: false, message: "Could not send reset email. Please try again." })
    }
    return json({ ok: true, message: "Password reset email sent. Check your inbox." })
  }

  return json({ ok: false, message: "Unsupported authentication request." })
}
