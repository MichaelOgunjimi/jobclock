import { createClient } from "@/lib/supabase/server"
import { findStripeSubscriptionId, projectSubscription } from "@/lib/billing/store"
import { getStripe } from "@/lib/billing/stripe"
import { billingRateLimit } from "@/lib/rate-limit"

// Undoes a scheduled cancellation without sending the user to the Stripe portal. The subscription id is always
// the one stored for the signed-in user, never one from the request.
export async function POST() {
  if (process.env.BILLING_ENABLED !== "true") {
    return Response.json({ error: "Billing is not available" }, { status: 503 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { success } = await billingRateLimit.limit(`resume:${user.id}`)
  if (!success) return Response.json({ error: "Too many requests" }, { status: 429 })

  const subscriptionId = await findStripeSubscriptionId(user.id)
  if (!subscriptionId) return Response.json({ error: "No subscription found" }, { status: 404 })

  const stripe = getStripe()
  const current = await stripe.subscriptions.retrieve(subscriptionId)
  if (current.status !== "active" && current.status !== "trialing") {
    return Response.json({ error: "This subscription has ended. Start a new one from the pricing page." }, { status: 409 })
  }
  if (current.cancel_at_period_end || current.cancel_at != null) {
    // Clearing cancel_at_period_end also clears a cancel_at set by the portal.
    const resumed = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false })
    // Project now so Billing is correct on reload; the matching webhook is then an older, ignored duplicate.
    await projectSubscription(resumed, Math.floor(Date.now() / 1000))
  }
  return Response.json({ resumed: true })
}
