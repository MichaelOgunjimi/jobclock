import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseConfig, getSupabaseSetupHint } from "@/lib/supabase/config"
import type { Database } from "@/lib/supabase/database.types"

function makeRedirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url))
}

function messageUrl(request: NextRequest, message: string, status: "error" | "success") {
  return new URL(`/auth?status=${status}&message=${encodeURIComponent(message)}`, request.url)
}

export async function POST(request: NextRequest) {
  const config = getSupabaseConfig()

  if (!config) {
    return NextResponse.redirect(messageUrl(request, getSupabaseSetupHint(), "error"))
  }

  const formData = await request.formData()
  const intent = String(formData.get("intent") ?? "signin")
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const origin = new URL(request.url).origin

  if (!email) {
    return NextResponse.redirect(messageUrl(request, "Enter your email address.", "error"))
  }

  if (intent !== "magic_link" && !password) {
    return NextResponse.redirect(messageUrl(request, "Enter your password.", "error"))
  }

  // Collect cookies written by Supabase (PKCE verifier, session tokens, etc.)
  // and apply them to whatever response we actually return.
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

  function withCookies(res: NextResponse): NextResponse {
    pendingCookies.forEach(({ name, value, options }) =>
      res.cookies.set(name, value, options as Parameters<typeof res.cookies.set>[2])
    )
    return res
  }

  if (intent === "signin") {
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return NextResponse.redirect(messageUrl(request, "Invalid email or password.", "error"))
    }

    return withCookies(makeRedirect(request, "/dashboard"))
  }

  if (intent === "signup") {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    })

    if (error) {
      return NextResponse.redirect(messageUrl(request, "Could not create account. Please try again.", "error"))
    }

    if (data.session) {
      return withCookies(makeRedirect(request, "/dashboard"))
    }

    // Email confirmation required — carry PKCE verifier cookie so the
    // callback can exchange the code when the user clicks the link.
    return withCookies(
      NextResponse.redirect(
        messageUrl(request, "Check your email for a confirmation link.", "success")
      )
    )
  }

  if (intent === "magic_link") {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    })

    if (error) {
      return NextResponse.redirect(messageUrl(request, error.message, "error"))
    }

    // Carry the PKCE verifier cookie so the callback can exchange the code.
    return withCookies(
      NextResponse.redirect(messageUrl(request, "Magic link sent. Check your inbox.", "success"))
    )
  }

  return NextResponse.redirect(messageUrl(request, "Unsupported authentication request.", "error"))
}
