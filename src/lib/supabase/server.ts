import { createServerClient, type SetAllCookies } from "@supabase/ssr"
import { cookies } from "next/headers"
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
