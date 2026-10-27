/**
 * Creates a confirmed demo user in the LOCAL Supabase stack so you can sign in without email.
 * Usage: make seed   (needs `make db-local` first)
 * Runs only against localhost; there is no realistic sample data yet, just the account.
 */
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) {
  console.error(`❌  Refusing to seed ${url}: this script only runs against the local Supabase stack.`)
  process.exit(1)
}
if (!key) {
  console.error("❌  SUPABASE_SERVICE_ROLE_KEY is not set (make seed reads it from `supabase status -o env`)")
  process.exit(1)
}

async function main() {
  const email = "demo@jobclock.test"
  const password = "demo-password-123"
  const { error } = await createClient(url, key!).auth.admin.createUser({ email, password, email_confirm: true })
  if (error && !/already.*registered|already exists/i.test(error.message)) {
    console.error(`❌  ${error.message}`)
    process.exit(1)
  }
  console.log(`✅  ${email} / ${password}${error ? " (already existed)" : ""}`)
}

void main()
