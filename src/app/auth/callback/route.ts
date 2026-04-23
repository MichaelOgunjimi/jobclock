import { createServerClient, type SetAllCookies } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseConfig, getSupabaseSetupHint } from "@/lib/supabase/config"
import type { Database } from "@/lib/supabase/database.types"
import type { EmailOtpType } from "@supabase/supabase-js"

export async function GET(request: NextRequest) {
  const config = getSupabaseConfig()

  if (!config) {
    return NextResponse.redirect(new URL(`/auth?status=error&message=${encodeURIComponent(getSupabaseSetupHint())}`, request.url))
  }

  const { searchParams } = request.nextUrl
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const rawNext = searchParams.get("next") ?? "/dashboard"
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard"

  let response = NextResponse.redirect(new URL(next, request.url), { status: 303 })

  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        response = NextResponse.redirect(new URL(next, request.url), { status: 303 })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  // token_hash flow — works across browsers/devices, no PKCE verifier needed
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) {
      console.error("[auth/callback] verifyOtp error:", error.message)
      return NextResponse.redirect(
        new URL(`/auth?status=error&message=${encodeURIComponent(error.message)}`, request.url),
        { status: 303 }
      )
    }
    return response
  }

  // code flow — PKCE exchange (OAuth providers, same-browser email flows)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("[auth/callback] exchangeCodeForSession error:", error.message)
      return NextResponse.redirect(
        new URL(`/auth?status=error&message=${encodeURIComponent(error.message)}`, request.url),
        { status: 303 }
      )
    }
    return response
  }

  return NextResponse.redirect(
    new URL("/auth?status=error&message=Missing%20authentication%20code.", request.url),
    { status: 303 }
  )
}
