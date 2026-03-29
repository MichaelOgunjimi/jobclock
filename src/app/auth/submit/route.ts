import { createServerClient, type SetAllCookies } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseConfig, getSupabaseSetupHint } from "@/lib/supabase/config"
import type { Database } from "@/lib/supabase/database.types"

function redirectWithMessage(request: NextRequest, message: string, status: "error" | "success" = "error") {
  return NextResponse.redirect(
    new URL(`/auth?status=${status}&message=${encodeURIComponent(message)}`, request.url)
  )
}

export async function POST(request: NextRequest) {
  const config = getSupabaseConfig()

  if (!config) {
    return redirectWithMessage(request, getSupabaseSetupHint())
  }

  const formData = await request.formData()
  const intent = String(formData.get("intent") ?? "signin")
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const origin = new URL(request.url).origin

  if (!email) {
    return redirectWithMessage(request, "Enter your email address.")
  }

  if (intent !== "magic_link" && !password) {
    return redirectWithMessage(request, "Enter your password.")
  }

  let response = NextResponse.redirect(new URL("/dashboard", request.url))

  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        response = NextResponse.redirect(new URL("/dashboard", request.url))
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  if (intent === "signin") {
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return redirectWithMessage(request, error.message)
    }

    return response
  }

  if (intent === "signup") {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })

    if (error) {
      return redirectWithMessage(request, error.message)
    }

    if (data.session) {
      return response
    }

    return redirectWithMessage(request, "Check your email for a confirmation link.", "success")
  }

  if (intent === "magic_link") {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    })

    if (error) {
      return redirectWithMessage(request, error.message)
    }

    return redirectWithMessage(request, "Magic link sent. Check your inbox.", "success")
  }

  return redirectWithMessage(request, "Unsupported authentication request.")
}
