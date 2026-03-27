const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const

export interface SupabaseConfig {
  url: string
  anonKey: string
}

function hasConfiguredValue(value: string | undefined) {
  return Boolean(value && !value.startsWith("your-"))
}

export const SUPABASE_SETUP_MESSAGE =
  "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!hasConfiguredValue(url) || !hasConfiguredValue(anonKey)) {
    return null
  }

  return { url: url!, anonKey: anonKey! }
}

export function isSupabaseConfigured() {
  return getSupabaseConfig() !== null
}

export function getSupabaseSetupHint() {
  return [
    SUPABASE_SETUP_MESSAGE,
    `Missing values: ${REQUIRED_ENV_VARS.filter((name) => !hasConfiguredValue(process.env[name])).join(", ") || "none"}`,
  ].join(" ")
}
