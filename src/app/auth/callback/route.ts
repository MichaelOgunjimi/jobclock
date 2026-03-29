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
  const next = request.nextUrl.searchParams.get("next") ?? "/dashboard"

  if (!code) {
    return NextResponse.redirect(new URL("/auth?status=error&message=Missing%20authentication%20code.", request.url))
  }

  let response = NextResponse.redirect(new URL(next, request.url))

  const supabase = createServerClient<Database>(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        response = NextResponse.redirect(new URL(next, request.url))
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth?status=error&message=${encodeURIComponent(error.message)}`, request.url)
    )
  }

  return response
}
