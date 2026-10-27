/**
 * Shows which environment the current shell / env file points at, without printing secrets.
 * Usage: npm run env:check [-- path/to/env-file]   (defaults to .env.local)
 * Exits 1 if the configuration points at production.
 */
import { existsSync } from "node:fs"
import { productionRefIn } from "../src/lib/env-guard"

const file = process.argv[2] ?? ".env.local"
if (existsSync(file)) process.loadEnvFile(file)
else console.log(`(no ${file}; showing the shell environment only)`)

const host = (value?: string) => {
  try {
    const url = new URL(value ?? "")
    return `${url.username ? `${url.username}@` : ""}${url.hostname}:${url.port || "default"}`
  } catch {
    return value ? "(unparseable)" : "(not set)"
  }
}

const e = process.env
const ref = productionRefIn(e.NEXT_PUBLIC_SUPABASE_URL, e.DATABASE_URL, e.DATABASE_DIRECT_URL)
console.log(`file:         ${file}`)
console.log(`APP_ENV:      ${e.APP_ENV ?? "(not set)"}`)
console.log(`supabase:     ${host(e.NEXT_PUBLIC_SUPABASE_URL)}`)
console.log(`DATABASE_URL: ${host(e.DATABASE_URL)}`)
console.log(`DIRECT_URL:   ${host(e.DATABASE_DIRECT_URL)}`)
console.log(`app url:      ${e.NEXT_PUBLIC_APP_URL ?? "(not set)"}`)
console.log(`stripe:       ${e.STRIPE_RESTRICTED_KEY ? e.STRIPE_RESTRICTED_KEY.slice(0, 8) + "…" : "(not set)"}  billing=${e.BILLING_ENABLED ?? "unset"}`)
console.log(`upstash:      ${host(e.UPSTASH_REDIS_REST_URL)}`)
if (ref) {
  console.log(`\n⚠️  PRODUCTION database (${ref}) is configured. Migrations, scripts and tests will refuse to run.`)
  process.exit(1)
}
console.log("\n✓ not production")
