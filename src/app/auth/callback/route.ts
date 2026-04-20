import { createServerClient, type SetAllCookies } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseConfig, getSupabaseSetupHint } from "@/lib/supabase/config"
import type { Database } from "@/lib/supabase/database.types"

export async function GET(request: NextRequest) {
  const config = getSupabaseConfig()

  if (!config) {
    return NextResponse.redirect(new URL(`/auth?status=error&message=${encodeURIComponent(getSupabaseSetupHint())}`, request.url))
  }

  const code = request.nextUrl.searchParams.get("code")
  const rawNext = request.nextUrl.searchParams.get("next") ?? "/dashboard"
  // Reject absolute URLs and protocol-relative paths to prevent open redirect
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard"

  if (!code) {
    return NextResponse.redirect(new URL("/auth?status=error&message=Missing%20authentication%20code.", request.url), { status: 303 })
  }

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
