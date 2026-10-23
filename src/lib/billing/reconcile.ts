import "server-only"

import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { projectSubscription } from "./store"
import { getStripe } from "./stripe"

const BATCH_SIZE = 100
const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused"])

// Repairs drift when webhooks are missed or delayed: re-reads each live subscription from Stripe
// and projects it through the same store function as the webhook, so stale-event protection applies.
// Also reports (never cancels or refunds) any extra live subscription on a customer, so a double purchase gets a human decision.
// ponytail: single batch of the least-recently-updated rows per run, paginate if live subscriptions exceed BATCH_SIZE per day.
export async function reconcileSubscriptions(): Promise<{ checked: number; failed: number; errors: string[]; duplicates: string[] }> {
  const rows = await db.execute<{ stripe_subscription_id: string }>(sql`
    select stripe_subscription_id from billing_subscriptions
    where status in ('active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete')
    order by updated_at asc
    limit ${BATCH_SIZE}
  `)
  const stripe = getStripe()
  const errors: string[] = []
  const duplicates: string[] = []
  for (const row of rows) {
    try {
      const subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id)
      // A fresh retrieve is authoritative as of now.
      await projectSubscription(subscription, Math.floor(Date.now() / 1000))
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
      const { data: all } = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 })
      for (const other of all) {
        if (other.id !== subscription.id && LIVE_STATUSES.has(other.status)) {
          duplicates.push(`${other.id} (customer ${customerId}, tracked ${subscription.id})`)
        }
      }
    } catch (error) {
      errors.push(`${row.stripe_subscription_id}: ${error instanceof Error ? error.message : "unknown error"}`)
    }
  }
  if (duplicates.length) console.error("[billing] duplicate live subscriptions need review:", duplicates)
  return { checked: rows.length, failed: errors.length, errors, duplicates }
}
