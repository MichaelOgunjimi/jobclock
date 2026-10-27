/**
 * Grant (or revoke) a plan without Stripe: lifetime owner access, or a comp for a friend or beta tester.
 * Usage: npm run billing:grant -- <email> [--kind=lifetime|comp] [--credits=N] [--days=N] [--note=text] [--revoke] [--yes]
 *
 * No --credits means unmetered credits. Without --yes this is a dry run that only shows the target database.
 * It writes to whatever DATABASE_URL points at, so check the host it prints before passing --yes.
 */

import postgres from "postgres"
import { assertNotProduction } from "../src/lib/env-guard"

const args = process.argv.slice(2)
const email = args.find((a) => !a.startsWith("--"))?.toLowerCase()
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=")
const has = (name: string) => args.includes(`--${name}`)

const kind = flag("kind") ?? "lifetime"
const credits = flag("credits") === undefined ? null : Number(flag("credits"))
const days = flag("days") === undefined ? null : Number(flag("days"))
const note = flag("note") ?? null

function fail(message: string): never {
  console.error(`❌  ${message}`)
  process.exit(1)
}

if (!email) fail("Usage: npm run billing:grant -- <email> [--kind=lifetime|comp] [--credits=N] [--days=N] [--note=text] [--revoke] [--yes]")
if (kind !== "lifetime" && kind !== "comp") fail("--kind must be lifetime or comp")
if (credits !== null && (!Number.isInteger(credits) || credits < 0)) fail("--credits must be a whole number, 0 or more")
if (days !== null && (!Number.isInteger(days) || days <= 0)) fail("--days must be a positive whole number")
if (kind === "lifetime" && days !== null) fail("a lifetime grant does not expire; use --kind=comp with --days")
const url = process.env.DATABASE_URL
if (!url) fail("DATABASE_URL is not set")
// Applying (--yes) writes entitlements. Production needs the explicit ALLOW_PRODUCTION=<ref> opt-in.
if (args.includes("--yes")) {
  try {
    assertNotProduction("billing:grant", url)
  } catch (err) {
    fail((err as Error).message)
  }
}

async function main() {
  const sql = postgres(url, { prepare: false })
  try {
    console.log(`Database host: ${new URL(url).host}`)
    const [user] = await sql<{ id: string }[]>`select id from auth.users where lower(email) = ${email} limit 1`
    if (!user) fail(`No account found for ${email} in this database`)
    const [profile] = await sql`select 1 from profiles where id = ${user.id}`
    if (!profile) fail(`${email} has no profile row yet; sign in once first`)

    const plan = has("revoke")
      ? `REVOKE the grant for ${email}`
      : `GRANT ${kind} to ${email} (${credits === null ? "unmetered credits" : `${credits} credits a month`}${days ? `, expires in ${days} days` : ", no expiry"})`
    console.log(plan)
    if (!has("yes")) {
      console.log("Dry run. Re-run with --yes to apply.")
      return
    }

    if (has("revoke")) {
      const rows = await sql`delete from billing_grants where user_id = ${user.id} returning user_id`
      console.log(rows.length ? "✓ revoked" : "Nothing to revoke")
    } else {
      await sql`
        insert into billing_grants (user_id, kind, credit_limit, expires_at, note, granted_by)
        values (${user.id}, ${kind}, ${credits}, ${days ? sql`now() + (${days} || ' days')::interval` : null}, ${note}, 'scripts/grant-plan.ts')
        on conflict (user_id) do update set
          kind = excluded.kind, credit_limit = excluded.credit_limit, expires_at = excluded.expires_at,
          note = excluded.note, granted_by = excluded.granted_by
      `
      const [saved] = await sql<{ kind: string; credit_limit: number | null; expires_at: Date | null }[]>`
        select kind, credit_limit, expires_at from billing_grants where user_id = ${user.id}
      `
      if (!saved || saved.kind !== kind || saved.credit_limit !== credits) fail("Grant verification failed")
      console.log("✓ granted and verified")
    }
  } finally {
    await sql.end()
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : "Grant failed"))
