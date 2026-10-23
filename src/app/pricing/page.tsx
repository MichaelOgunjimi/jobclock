import type { Metadata } from "next"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { PricingPlans } from "./pricing-plans"
import { AI_CREDIT_WEIGHTS, CREDIT_PACKS, PRO_CREDIT_LIMIT } from "@/lib/billing/plans"
import { formatPounds } from "@/lib/format-pounds"
import { resolveEntitlement, SUBSCRIPTION_STATUSES, toPlanGrant, type SubscriptionStatus } from "@/lib/billing/entitlements"

export const metadata: Metadata = {
  title: "Pricing",
  description: `Use JobClock for free with your own AI key, or upgrade to Pro for ${PRO_CREDIT_LIMIT} monthly AI credits, with extra credits available any time.`,
}

const pricePacks = Object.values(CREDIT_PACKS)
  .map((pack) => `${pack.credits} for ${formatPounds(pack.amountPence)}`)
  .join(" or ")
const w = AI_CREDIT_WEIGHTS

export default async function PricingPage() {
  let signedIn = false
  let isPro = false
  let lifetime = false

  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    signedIn = Boolean(user)
    if (user) {
      const { data } = await supabase.from("billing_subscriptions").select("status, grace_ends_at").eq("user_id", user.id).maybeSingle()
      const status = SUBSCRIPTION_STATUSES.includes(data?.status as SubscriptionStatus) ? data?.status as SubscriptionStatus : null
      const { data: grantRow } = await supabase.from("billing_grants").select("kind, expires_at").eq("user_id", user.id).maybeSingle()
      const entitlement = resolveEntitlement(status ? {
        status,
        graceEndsAt: data?.grace_ends_at ? new Date(data.grace_ends_at) : null,
      } : null, false, new Date(), toPlanGrant(grantRow))
      isPro = entitlement.plan === "pro"
      lifetime = entitlement.granted
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" className="font-heading text-xl tracking-[-0.03em]">JobClock</Link>
          <Link href={signedIn ? "/dashboard" : "/auth?next=/pricing"} className="text-sm text-muted-foreground hover:text-foreground">{signedIn ? "Dashboard" : "Sign in"}</Link>
        </div>
      </header>
      <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
        <div className="mx-auto mb-12 max-w-3xl space-y-4 text-center">
          <p className="page-kicker">Simple pricing</p>
          <h1 className="page-title text-4xl sm:text-6xl">Your workspace stays useful for free.</h1>
          <p className="page-lede">Connect your own AI key whenever you want, or let Pro handle AI provider access for you.</p>
        </div>
        <PricingPlans signedIn={signedIn} isPro={isPro} lifetime={lifetime} monthlyCredits={PRO_CREDIT_LIMIT} />
        <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-6 text-muted-foreground">No surprise charges. If you use your monthly allowance, Pro members can buy extra credits ({pricePacks}) or keep working with their own AI-provider key until it renews.</p>
        <section className="mt-16 border-t pt-12">
          <p className="page-kicker text-center">Questions</p>
          <div className="mt-6 grid gap-px border bg-border md:grid-cols-2">
            {[
              ["Do I need an API key?", "Free AI generation uses your own OpenAI or Anthropic key. Pro can generate with JobClock credits instead."],
              ["How do credits work?", `Pro includes ${PRO_CREDIT_LIMIT} credits every month, including on the yearly plan, and unused monthly credits do not roll over. Pro members can also buy extra credits that never expire and are used after the monthly allowance.`],
              ["What does each action cost?", `Importing a job costs ${w.job_import} credit, a chat message ${w.application_chat}, an interview answer ${w.interview_answer}, a cover letter ${w.cover_letter}, company research ${w.company_research} and a tailored CV ${w.cv_tailoring}.`],
              ["Can I cancel?", "Yes, any time from Settings → Billing. You keep Pro through the end of your paid period, then move to Free with all your data."],
              ["What happens to my data?", "Nothing is deleted or hidden when you return to Free. Your workspace and BYOK generation remain available."],
            ].map(([question, answer]) => <div key={question} className="bg-background p-6"><h2 className="font-medium">{question}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{answer}</p></div>)}
          </div>
        </section>
      </div>
    </main>
  )
}
