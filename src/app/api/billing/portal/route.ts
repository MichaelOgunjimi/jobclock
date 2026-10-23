import { createClient } from "@/lib/supabase/server"
import { findStripeCustomerId } from "@/lib/billing/store"
import { getBillingOrigin, getStripe } from "@/lib/billing/stripe"
import { billingRateLimit } from "@/lib/rate-limit"

export async function POST() {
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
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${getBillingOrigin()}/settings?tab=billing`,
  })
  return Response.json({ url: session.url })
}

