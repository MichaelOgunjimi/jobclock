import "server-only"

import type Stripe from "stripe"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { getProPriceId } from "./plans"

// postgres-js cannot bind a JS Date inside a raw sql template; send an ISO string with an explicit cast.
const ts = (date: Date | null) => sql`${date ? date.toISOString() : null}::timestamptz`

const SUPPORTED_STATUSES = new Set([
  "active", "trialing", "past_due", "unpaid", "paused", "incomplete",
  "incomplete_expired", "canceled",
])

export async function findStripeCustomerId(userId: string): Promise<string | null> {
  const rows = await db.execute<{ stripe_customer_id: string }>(sql`
    select stripe_customer_id from billing_customers where user_id = ${userId} limit 1
  `)
  return rows[0]?.stripe_customer_id ?? null
}

export async function findStripeSubscriptionId(userId: string): Promise<string | null> {
  const rows = await db.execute<{ stripe_subscription_id: string }>(sql`
    select stripe_subscription_id from billing_subscriptions where user_id = ${userId} limit 1
  `)
  return rows[0]?.stripe_subscription_id ?? null
}

export async function saveStripeCustomer(userId: string, customerId: string): Promise<string> {
  const rows = await db.execute<{ stripe_customer_id: string }>(sql`
    insert into billing_customers (user_id, stripe_customer_id)
    values (${userId}, ${customerId})
    on conflict (user_id) do update set updated_at = now()
    returning stripe_customer_id
  `)
  return rows[0].stripe_customer_id
}

export async function hasPurchasableSubscription(userId: string): Promise<boolean> {
  const rows = await db.execute<{ exists: boolean }>(sql`
    select (
      exists(
        select 1 from billing_subscriptions
        where user_id = ${userId} and status in ('active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete')
      )
      or exists(
        select 1 from billing_grants
        where user_id = ${userId} and (expires_at is null or expires_at > now())
      )
    ) as exists
  `)
  return Boolean(rows[0]?.exists)
}

// One row per user: a different Stripe subscription may only take the row over once the tracked one has ended,
// so events for a stray duplicate subscription can never overwrite a live one.
export async function projectSubscription(subscription: Stripe.Subscription, stripeCreated: number): Promise<void> {
  if (!SUPPORTED_STATUSES.has(subscription.status)) {
    throw new Error(`Unsupported Stripe subscription status: ${subscription.status}`)
  }
  const item = subscription.items.data[0]
  if (!item) throw new Error("Stripe subscription has no items")
  const price = item.price
  if (![getProPriceId("monthly"), getProPriceId("annual")].includes(price.id)) {
    throw new Error(`Unknown Stripe price: ${price.id}`)
  }
  const productId = typeof price.product === "string" ? price.product : price.product.id
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
  const periodStart = new Date(item.current_period_start * 1000)
  const periodEnd = new Date(item.current_period_end * 1000)
  const stripeUpdatedAt = new Date(stripeCreated * 1000)

  const rows = await db.execute<{ user_id: string }>(sql`
    select user_id from billing_customers where stripe_customer_id = ${customerId} limit 1
  `)
  const userId = rows[0]?.user_id
  if (!userId) throw new Error(`Unknown Stripe customer: ${customerId}`)

  await db.execute(sql`
    insert into billing_subscriptions (
      user_id, stripe_subscription_id, stripe_product_id, stripe_price_id, status,
      billing_interval, current_period_start, current_period_end, cancel_at_period_end,
      canceled_at, past_due_at, grace_ends_at, stripe_updated_at
    ) values (
      ${userId}, ${subscription.id}, ${productId}, ${price.id}, ${subscription.status},
      ${price.recurring?.interval ?? "month"}, ${ts(periodStart)}, ${ts(periodEnd)},
      ${subscription.cancel_at_period_end},
      ${ts(subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null)},
      ${ts(subscription.status === "past_due" ? stripeUpdatedAt : null)},
      ${ts(subscription.status === "past_due" ? new Date((stripeCreated + 7 * 86400) * 1000) : null)},
      ${ts(stripeUpdatedAt)}
    )
    on conflict (user_id) do update set
      stripe_subscription_id = excluded.stripe_subscription_id,
      stripe_product_id = excluded.stripe_product_id,
      stripe_price_id = excluded.stripe_price_id,
      status = excluded.status,
      billing_interval = excluded.billing_interval,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      canceled_at = excluded.canceled_at,
      past_due_at = case when excluded.status = 'past_due' then coalesce(billing_subscriptions.past_due_at, excluded.past_due_at) else null end,
      grace_ends_at = case when excluded.status = 'past_due' then coalesce(billing_subscriptions.grace_ends_at, excluded.grace_ends_at) else null end,
      stripe_updated_at = excluded.stripe_updated_at,
      updated_at = now()
    where (billing_subscriptions.stripe_subscription_id = excluded.stripe_subscription_id
        or billing_subscriptions.status in ('canceled', 'incomplete_expired'))
      and (billing_subscriptions.stripe_updated_at is null
        or billing_subscriptions.stripe_updated_at <= excluded.stripe_updated_at)
  `)
}

/** True while the user holds Pro: active, trialing, or past due inside the payment grace period. */
export async function hasActiveProSubscription(userId: string): Promise<boolean> {
  const rows = await db.execute<{ pro: boolean }>(sql`
    select exists(
      select 1 from billing_subscriptions
      where user_id = ${userId}
        and (status in ('active', 'trialing') or (status = 'past_due' and grace_ends_at > now()))
    ) as pro
  `)
  return Boolean(rows[0]?.pro)
}

export async function findUserIdByStripeCustomer(customerId: string): Promise<string | null> {
  const rows = await db.execute<{ user_id: string }>(sql`
    select user_id from billing_customers where stripe_customer_id = ${customerId} limit 1
  `)
  return rows[0]?.user_id ?? null
}

export async function beginWebhookEvent(event: Stripe.Event): Promise<boolean> {
  const object = event.data.object as { id?: string }
  const rows = await db.execute<{ stripe_event_id: string }>(sql`
    insert into billing_webhook_events (
      stripe_event_id, type, stripe_object_id, stripe_created_at, status
    ) values (
      ${event.id}, ${event.type}, ${object.id ?? null}, ${ts(new Date(event.created * 1000))}, 'processing'
    )
    on conflict (stripe_event_id) do update set status = 'processing', error = null
      where billing_webhook_events.status = 'failed'
    returning stripe_event_id
  `)
  return rows.length > 0
}

export async function finishWebhookEvent(
  eventId: string,
  status: "processed" | "ignored" | "failed",
  error?: string,
): Promise<void> {
  await db.execute(sql`
    update billing_webhook_events set
      status = ${status}, processed_at = ${ts(status === "failed" ? null : new Date())},
      error = ${error?.slice(0, 500) ?? null}
    where stripe_event_id = ${eventId}
  `)
}
