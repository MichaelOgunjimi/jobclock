import { z } from "zod/v4"
import { createClient } from "@/lib/supabase/server"
import { billingRateLimit } from "@/lib/rate-limit"
import { checkoutIntegrationIdentifier, getBillingOrigin, getStripe } from "@/lib/billing/stripe"
import { findStripeCustomerId, hasPurchasableSubscription, saveStripeCustomer } from "@/lib/billing/store"
import { getProPriceId } from "@/lib/billing/plans"

// Where to send the user if they back out of Checkout: a path on our own site only, never another origin.
const returnPathSchema = z.string().max(200).regex(/^\/(?!\/)[A-Za-z0-9\-._~/?=&%]*$/)
const requestSchema = z.object({ cadence: z.enum(["monthly", "annual"]), returnPath: returnPathSchema.optional() })

const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "paused"])

export async function POST(request: Request) {
  if (process.env.BILLING_ENABLED !== "true") {
    return Response.json({ error: "Billing is not available" }, { status: 503 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { success } = await billingRateLimit.limit(`checkout:${user.id}`)
  if (!success) return Response.json({ error: "Too many requests" }, { status: 429 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid billing cadence" }, { status: 400 })
  if (await hasPurchasableSubscription(user.id)) {
    return Response.json({ error: "A subscription already exists" }, { status: 409 })
  }

  let priceId: string
  try {
    priceId = getProPriceId(parsed.data.cadence)
  } catch {
    return Response.json({ error: "Billing is not configured" }, { status: 503 })
  }

  const stripe = getStripe()
  let customerId = await findStripeCustomerId(user.id)
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { jobclock_user_id: user.id },
    })
    customerId = await saveStripeCustomer(user.id, customer.id)
  }

  // Our database can lag Stripe (e.g. a failed webhook), so Stripe is the source of truth for duplicates.
  const existing = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 })
  if (existing.data.some((subscription) => LIVE_STATUSES.has(subscription.status))) {
    return Response.json({ error: "You already have a subscription. If it isn't showing yet, refresh Settings → Billing in a minute." }, { status: 409 })
  }

  const origin = getBillingOrigin()
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    integration_identifier: checkoutIntegrationIdentifier(),
    line_items: [{ price: priceId, quantity: 1 }],
    // Promotion codes are off at launch; turn on here (and test one) before offering any discount.
    allow_promotion_codes: false,
    success_url: `${origin}/settings?tab=billing&checkout=success`,
    cancel_url: `${origin}${parsed.data.returnPath ?? "/pricing?checkout=canceled"}`,
  })
  if (!session.url) throw new Error("Stripe Checkout did not return a URL")
  return Response.json({ url: session.url })
}

