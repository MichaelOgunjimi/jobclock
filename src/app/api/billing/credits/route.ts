import { z } from "zod/v4"
import { createClient } from "@/lib/supabase/server"
import { billingRateLimit } from "@/lib/rate-limit"
import { checkoutIntegrationIdentifier, getBillingOrigin, getStripe } from "@/lib/billing/stripe"
import { findStripeCustomerId, hasActiveProSubscription } from "@/lib/billing/store"
import { CREDIT_PACKS, type CreditPackId } from "@/lib/billing/plans"

const requestSchema = z.object({ pack: z.enum(Object.keys(CREDIT_PACKS) as [CreditPackId, ...CreditPackId[]]) })

export async function POST(request: Request) {
  if (process.env.BILLING_ENABLED !== "true") {
    return Response.json({ error: "Billing is not available" }, { status: 503 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { success } = await billingRateLimit.limit(`credits:${user.id}`)
  if (!success) return Response.json({ error: "Too many requests" }, { status: 429 })

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: "Invalid credit pack" }, { status: 400 })
  if (!await hasActiveProSubscription(user.id)) {
    return Response.json({ error: "Credit packs are available to JobClock Pro subscribers" }, { status: 403 })
  }
  const customerId = await findStripeCustomerId(user.id)
  if (!customerId) return Response.json({ error: "Billing is not configured for this account" }, { status: 409 })

  const packId = parsed.data.pack
  const pack = CREDIT_PACKS[packId]
  const metadata = { jobclock_kind: "credit_pack", jobclock_user_id: user.id, pack: packId }
  const origin = getBillingOrigin()
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    client_reference_id: user.id,
    integration_identifier: checkoutIntegrationIdentifier(),
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "gbp",
        unit_amount: pack.amountPence,
        product_data: { name: `${pack.credits} JobClock AI credits` },
      },
    }],
    metadata,
    payment_intent_data: { metadata },
    success_url: `${origin}/settings?tab=billing&credits=success`,
    cancel_url: `${origin}/settings?tab=billing`,
  })
  if (!session.url) throw new Error("Stripe Checkout did not return a URL")
  return Response.json({ url: session.url })
}
