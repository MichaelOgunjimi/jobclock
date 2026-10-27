// Supabase project refs that hold real user data. Update when production moves to another project.
export const PRODUCTION_REFS = ["mdnkrzarlaqhozzzozpq"] as const

export function productionRefIn(...values: (string | undefined)[]): string | undefined {
  return PRODUCTION_REFS.find((ref) => values.some((value) => value?.includes(ref)))
}

/** Throws if any value points at production, unless ALLOW_PRODUCTION names that exact project ref. */
export function assertNotProduction(label: string, ...values: (string | undefined)[]) {
  const ref = productionRefIn(...values)
  if (ref && process.env.ALLOW_PRODUCTION !== ref) {
    throw new Error(`${label} is pointed at PRODUCTION (${ref}). Refusing. If that is intended, rerun with ALLOW_PRODUCTION=${ref}.`)
  }
}

/** What a running app should say about the database it is configured with, or null if all is well. */
export function runtimeEnvProblem(env: NodeJS.ProcessEnv): { level: "error" | "warn"; message: string } | null {
  const ref = productionRefIn(env.NEXT_PUBLIC_SUPABASE_URL, env.DATABASE_URL, env.DATABASE_DIRECT_URL)
  if (!ref || env.APP_ENV === "production" || env.VERCEL_ENV === "production") return null

  const where = env.APP_ENV ?? env.VERCEL_ENV
  if (where) return { level: "error", message: `${where} is configured with the PRODUCTION database (${ref}).` }
  return { level: "warn", message: `APP_ENV is not set and the PRODUCTION database (${ref}) is configured. Point .env.local at the local stack (see .env.supabase-local.example).` }
}
