/**
 * Read-only quote for a usage-based refund, per the Terms: within 14 days of purchase, refund what was paid
 * minus the credits used, at the per-credit price of what was bought.
 * Usage: npm run refund:quote -- someone@example.com
 *
 * It never touches Stripe or the database writes; issue the refund by hand in the Stripe dashboard.
 * Pack quotes are estimates: the balance does not record which pack a spent credit came from, so
 * remaining credits are assigned to the newest packs first.
 */

import postgres from "postgres"
import { PRO_CREDIT_LIMIT, PRO_PRICES } from "../src/lib/billing/pro-plan"

const REFUND_WINDOW_DAYS = 14
const MONTHS_PER_YEAR = 12

const pounds = (pence: number) => `£${(pence / 100).toFixed(2)}`
const daysSince = (date: Date) => (Date.now() - date.getTime()) / 86_400_000

async function main() {
  const email = process.argv[2]
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_DIRECT_URL
  if (!email || email.startsWith("--")) {
    console.error("Usage: npm run refund:quote -- someone@example.com")
    process.exit(1)
  }
  if (!url) {
    console.error("❌  DATABASE_URL is not set")
    process.exit(1)
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} })
  try {
    const [user] = await sql<{ id: string }[]>`select id from auth.users where lower(email) = lower(${email}) limit 1`
    if (!user) {
      console.error(`❌  No account for ${email}`)
      process.exit(1)
    }
    console.log(`Account ${email} (${user.id})\n`)

    const [subscription] = await sql<{ status: string; billing_interval: string; current_period_start: Date }[]>`
      select status, billing_interval, current_period_start from billing_subscriptions where user_id = ${user.id} limit 1`
    if (!subscription) {
      console.log("Subscription: none")
    } else {
      const yearly = subscription.billing_interval === "year"
      const paidPence = yearly ? PRO_PRICES.annual.amountPence : PRO_PRICES.monthly.amountPence
      const credits = yearly ? PRO_CREDIT_LIMIT * MONTHS_PER_YEAR : PRO_CREDIT_LIMIT
      const [{ used }] = await sql<{ used: string }[]>`
        select coalesce(sum(credits), 0) as used from ai_usage_actions
        where user_id = ${user.id} and status = 'completed' and created_at >= ${subscription.current_period_start}`
      const days = daysSince(new Date(subscription.current_period_start))
      const usedCredits = Number(used)
      const refundPence = Math.max(0, Math.round(paidPence - usedCredits * (paidPence / credits)))
      console.log(`Subscription: ${yearly ? "yearly" : "monthly"} (${subscription.status}), paid ${pounds(paidPence)} on ${new Date(subscription.current_period_start).toISOString().slice(0, 10)}`)
      console.log(`  ${days.toFixed(1)} days ago, ${usedCredits} of ${credits} credits used at £${(paidPence / credits / 100).toFixed(3)} each`)
      console.log(days <= REFUND_WINDOW_DAYS
        ? `  → Refund ${pounds(refundPence)}`
        : `  → Outside the ${REFUND_WINDOW_DAYS}-day window: no refund unless the law requires one or the charge was an error`)
    }

    const packs = await sql<{ pack: string; credits: number; amount_pence: number; created_at: Date }[]>`
      select pack, credits, amount_pence, created_at from ai_credit_purchases where user_id = ${user.id} order by created_at desc`
    const [balance] = await sql<{ credits: number }[]>`select credits from ai_credit_balances where user_id = ${user.id}`
    let remaining = balance?.credits ?? 0
    console.log(`\nExtra credit packs (balance ${remaining}):`)
    if (packs.length === 0) console.log("  none")
    for (const pack of packs) {
      const unused = Math.min(remaining, pack.credits)
      remaining -= unused
      const days = daysSince(new Date(pack.created_at))
      const refundPence = Math.round(pack.amount_pence * (unused / pack.credits))
      console.log(`  ${pack.pack}: ${pounds(pack.amount_pence)} on ${new Date(pack.created_at).toISOString().slice(0, 10)}, ${unused}/${pack.credits} credits unused`)
      console.log(days <= REFUND_WINDOW_DAYS
        ? `  → Refund about ${pounds(refundPence)}`
        : `  → Outside the ${REFUND_WINDOW_DAYS}-day window`)
    }
    console.log("\nIssue any refund by hand: Stripe dashboard → Payments → the charge → Refund.")
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error("❌ ", error instanceof Error ? error.message : error)
  process.exit(1)
})
