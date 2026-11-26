import { createServerClient, type SetAllCookies } from "@supabase/ssr"
import { cookies } from "next/headers"
import { cache } from "react"
import type { Database } from "./database.types"
import { getSupabaseConfig, getSupabaseSetupHint } from "./config"

export async function createClient() {
  const cookieStore = await cookies()
  const config = getSupabaseConfig()

  if (!config) {
    throw new Error(getSupabaseSetupHint())
  }

  return createServerClient<Database>(
    config.url,
    config.anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}

/**
 * The signed-in user as proven by the access-token JWT, verified locally against the project's
 * JWKS (no Auth-server round trip). A revoked session therefore still renders until its access
 * token expires, so use this ONLY to render read-only pages. Server actions, route handlers,
 * writes, billing and consent screens must call `supabase.auth.getUser()` instead
 * (enforced by server.test.ts).
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const subject = data?.claims.sub

  if (error || !subject) return null

  return {
    id: subject,
    email: typeof data.claims.email === "string" ? data.claims.email : undefined,
  }
})
