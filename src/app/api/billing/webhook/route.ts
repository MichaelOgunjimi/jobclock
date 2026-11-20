import type Stripe from "stripe"
import { beginWebhookEvent, finishWebhookEvent, findUserIdByStripeCustomer, projectSubscription, preferJobclockAiForNewSubscriber } from "@/lib/billing/store"
import { getStripe } from "@/lib/billing/stripe"
import { CREDIT_PACKS, type CreditPackId } from "@/lib/billing/plans"
import { grantPurchasedCredits } from "@/lib/billing/usage"
import { sendEmail } from "@/lib/email/send"
import { getAppUrl } from "@/lib/site"

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription
  return typeof subscription === "string" ? subscription : subscription?.id ?? null
}

// A credit pack is granted only if the session matches a server-owned pack, was paid in full, and belongs to
// the Stripe customer saved for the user named in its metadata.
async function grantCreditPack(session: Stripe.Checkout.Session): Promise<boolean> {
  const { jobclock_user_id: userId, pack: packId } = session.metadata ?? {}
  if (!userId || !packId || !(packId in CREDIT_PACKS)) throw new Error("Credit pack session has invalid metadata")
  const pack = CREDIT_PACKS[packId as CreditPackId]
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id
  if (!customerId || await findUserIdByStripeCustomer(customerId) !== userId) {
    throw new Error("Credit pack session customer does not match the user")
  }
  if (session.currency !== "gbp" || session.amount_total !== pack.amountPence) {
    throw new Error("Credit pack session amount does not match the pack")
  }
  return grantPurchasedCredits({
    userId,
    checkoutSessionId: session.id,
    pack: packId as CreditPackId,
    credits: pack.credits,
    amountPence: pack.amountPence,
  })
}

const billingUrl = () => `${getAppUrl()}/settings?tab=billing`

// Stripe sends its own receipts, so only the two notices Stripe does not cover are sent here.
// Keyed by event id so a replayed webhook cannot email twice; sendEmail never throws.
function sendBillingEmail(eventId: string, to: string | null | undefined, subject: string, paragraphs: string[]) {
  if (!to) return Promise.resolve(false)
  return sendEmail({ to, subject, html: paragraphs.map((p) => `<p>${p}</p>`).join(""), idempotencyKey: eventId })
}

async function processEvent(event: Stripe.Event): Promise<boolean> {
  const stripe = getStripe()
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await projectSubscription(event.data.object, event.created)
      return true
    case "customer.subscription.deleted": {
      await projectSubscription(event.data.object, event.created)
      const customerId = event.data.object.customer
      const customer = await stripe.customers.retrieve(typeof customerId === "string" ? customerId : customerId.id).catch(() => null)
      await sendBillingEmail(event.id, customer && !customer.deleted ? customer.email : null, "Your JobClock Pro subscription has ended", [
        "Your JobClock Pro subscription has ended, and your account is now on the free plan.",
        "Nothing has been deleted. Your applications and documents are still there, and you can subscribe again any time from Settings → Billing: " + `<a href="${billingUrl()}">${billingUrl()}</a>`,
        "If you did not expect this, reply to this email.",
      ])
      return true
    }
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": { 
      const session = event.data.object
      if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return false
      if (session.mode === "payment") {
        return session.metadata?.jobclock_kind === "credit_pack" ? grantCreditPack(session) : false
      }
      const id = typeof session.subscription === "string" ? session.subscription : session.subscription?.id
      if (!id) return false
      const subscription = await stripe.subscriptions.retrieve(id)
      await projectSubscription(subscription, event.created)
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id
      const userId = await findUserIdByStripeCustomer(customerId)
      if (userId) await preferJobclockAiForNewSubscriber(userId)
      return true
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const id = invoiceSubscriptionId(event.data.object)
      if (!id) return false
      const subscription = await stripe.subscriptions.retrieve(id)
      if (event.type === "invoice.payment_failed") {
        subscription.status = "past_due"
      }
      await projectSubscription(subscription, event.created)
      // Stripe retries a failed invoice several times; tell the user once, on the first failure.
      if (event.type === "invoice.payment_failed" && event.data.object.attempt_count === 1) {
        await sendBillingEmail(event.id, event.data.object.customer_email, "Your JobClock payment did not go through", [
          "We could not take your latest JobClock Pro payment.",
          "Pro stays on for 7 days while Stripe tries again. To keep it, update your payment method in Settings → Billing: " + `<a href="${billingUrl()}">${billingUrl()}</a>`,
          "If you need help, reply to this email.",
        ])
      }
      return true
    }
    default:
      return false
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature")
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signature || !secret) return Response.json({ error: "Invalid webhook signature" }, { status: 400 })

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret)
  } catch {
    return Response.json({ error: "Invalid webhook signature" }, { status: 400 })
  }

  if (!await beginWebhookEvent(event)) return Response.json({ received: true })
  try {
    const processed = await processEvent(event)
    await finishWebhookEvent(event.id, processed ? "processed" : "ignored")
    return Response.json({ received: true })
  } catch (error) {
    await finishWebhookEvent(
      event.id,
      "failed",
      error instanceof Error ? error.message : "Webhook processing failed",
    )
    return Response.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}

