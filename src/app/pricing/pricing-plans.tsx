"use client"

import Link from "next/link"
import { useState } from "react"
import { Check } from "lucide-react"
import { BillingActionButton } from "@/components/billing-action-button"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button-styles"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const features = [
  "Core job-search and application workspace",
  "CVs, cover letters, evidence, interview prep, and exports",
  "AI generation with your own OpenAI or Anthropic key",
]

export function PricingPlans({ signedIn, isPro, lifetime = false, monthlyCredits }: { signedIn: boolean; isPro: boolean; lifetime?: boolean; monthlyCredits: number }) {
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly")

  return (
    <div className="space-y-8">
      <div className="mx-auto flex w-fit border bg-background p-1" role="group" aria-label="Billing cadence">
        {(["monthly", "annual"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={cadence === value}
            onClick={() => setCadence(value)}
            className={cn("px-4 py-2 text-sm capitalize transition-colors", cadence === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
          >
            {value}{value === "annual" ? " · 2 months free" : ""}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b pb-6">
            <Badge variant="outline">Free forever</Badge>
            <CardTitle className="mt-4 text-3xl">£0</CardTitle>
            <p className="text-sm text-muted-foreground">Organise your search, tailor applications, and prepare for interviews.</p>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <ul className="space-y-3 text-sm">
              {features.map((feature) => <li key={feature} className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0" />{feature}</li>)}
            </ul>
            <Link href={signedIn ? "/dashboard" : "/auth?next=/pricing"} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>Open Free workspace</Link>
          </CardContent>
        </Card>

        <Card className="border-foreground/30">
          <CardHeader className="border-b pb-6">
            <Badge>{isPro ? "Your plan" : "Pro"}</Badge>
            <CardTitle className="mt-4 text-3xl">{cadence === "monthly" ? "£12/month" : "£120/year"}</CardTitle>
            <p className="text-sm text-muted-foreground">Everything in Free, plus {monthlyCredits} JobClock AI credits every month.</p>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <ul className="space-y-3 text-sm">
              {[...features, "AI generation without a separate provider account", "Buy extra credits any time; they never expire", "Billing management through Stripe"].map((feature) => <li key={feature} className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0" />{feature}</li>)}
            </ul>
            {lifetime ? (
              <p className="border p-3 text-center text-sm">You have lifetime Pro access. Nothing to buy or manage.</p>
            ) : isPro ? (
              <BillingActionButton action="portal" className="w-full">Manage your plan</BillingActionButton>
            ) : signedIn ? (
              <BillingActionButton action="checkout" cadence={cadence} className="w-full">Upgrade to Pro</BillingActionButton>
            ) : (
              <Link href="/auth?next=/pricing" className={cn(buttonVariants(), "w-full")}>Sign in to upgrade</Link>
            )}
            <p className="text-center text-xs text-muted-foreground">The price you see is the price you pay. No VAT is added.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
