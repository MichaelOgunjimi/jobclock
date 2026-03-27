import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./database.types"
import { getSupabaseConfig, getSupabaseSetupHint } from "./config"

export function createClient() {
  const config = getSupabaseConfig()

  if (!config) {
    throw new Error(getSupabaseSetupHint())
  }

  return createBrowserClient<Database>(
    config.url,
    config.anonKey
  )
}
