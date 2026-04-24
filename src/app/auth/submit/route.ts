import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseConfig, getSupabaseSetupHint } from "@/lib/supabase/config"
import type { Database } from "@/lib/supabase/database.types"

type Result =
  | { ok: true; redirect: string }
  | { ok: true; message: string }
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
  const origin = new URL(request.url).origin

  if (!email) {
    return json({ ok: false, message: "Enter your email address." })
  }

  if (intent !== "magic_link" && intent !== "forgot_password" && !password) {
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
    return json({ ok: true, redirect: "/dashboard" }, pendingCookies)
  }

  if (intent === "signup") {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    })
    if (error) {
      console.error("[auth/signup] error:", error.status, error.message)
      return json({ ok: false, message: "Could not create account. Please try again." })
    }
    if (data.session) {
      return json({ ok: true, redirect: "/dashboard" }, pendingCookies)
    }
    return json({ ok: true, message: "Check your email for a confirmation link." }, pendingCookies)
  }

  if (intent === "magic_link") {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
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
