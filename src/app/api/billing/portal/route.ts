import { createClient } from "@/lib/supabase/server"
import { findStripeCustomerId, findStripeSubscriptionId } from "@/lib/billing/store"
import { getBillingOrigin, getStripe } from "@/lib/billing/stripe"
import { billingRateLimit } from "@/lib/rate-limit"

export async function POST(request: Request) {
  if (process.env.BILLING_ENABLED !== "true") {
    return Response.json({ error: "Billing is not available" }, { status: 503 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { success } = await billingRateLimit.limit(`portal:${user.id}`)
  if (!success) return Response.json({ error: "Too many requests" }, { status: 429 })

  const customerId = await findStripeCustomerId(user.id)
  if (!customerId) return Response.json({ error: "No billing account found" }, { status: 404 })
  const { flow } = await request.json().catch(() => ({})) as { flow?: string }
  const subscriptionId = flow === "cancel" || flow === "switch" ? await findStripeSubscriptionId(user.id) : null
  const params = {
    customer: customerId,
    return_url: `${getBillingOrigin()}/settings?tab=billing`,
  }
  // Deep-link straight into cancel / change plan; fall back to the portal home if Stripe rejects the flow.
  const flowData = !subscriptionId ? undefined : flow === "cancel"
    ? { type: "subscription_cancel" as const, subscription_cancel: { subscription: subscriptionId } }
    : { type: "subscription_update" as const, subscription_update: { subscription: subscriptionId } }
  const session = await getStripe().billingPortal.sessions.create({ ...params, flow_data: flowData })
    .catch(() => flowData ? getStripe().billingPortal.sessions.create(params) : Promise.reject(new Error("Portal unavailable")))
  return Response.json({ url: session.url })
}

