import { createServerClient, type SetAllCookies } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseConfig } from "@/lib/supabase/config"

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })
  const config = getSupabaseConfig()

  if (!config) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getClaims()

  return supabaseResponse
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|(?:extension|privacy|terms|cookies)(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
        { type: "header", key: "next-action" },
      ],
    },
  ],
}
