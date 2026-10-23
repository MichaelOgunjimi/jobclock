"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { BillingActionButton } from "@/components/billing-action-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button-styles"
import { formatPounds } from "@/lib/format-pounds"

export type BillingSummary = {
  plan: "free" | "pro"
  status: string | null
  cadence: "month" | "year" | null
  periodEnd: string | null
  cancelAtPeriodEnd: boolean
  creditsUsed: number
  creditLimit: number
  purchasedCredits: number
  creditPacks: { id: string; credits: number; amountPence: number }[]
}

export function BillingSettingsCard({ summary }: { summary: BillingSummary }) {
  const searchParams = useSearchParams()
  const checkoutPending = searchParams.get("checkout") === "success" && summary.plan === "free"
  const recoverable = summary.status === "past_due" || summary.status === "unpaid" || summary.status === "incomplete"
  const remaining = Math.max(0, summary.creditLimit - summary.creditsUsed)
  const creditsPurchased = searchParams.get("credits") === "success"
  const outOfCredits = summary.plan === "pro" && remaining === 0 && summary.purchasedCredits === 0

  return (
    <Card>
      <CardHeader className="border-b pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-label">Billing</p>
            <CardTitle className="mt-2">{summary.plan === "pro" ? "JobClock Pro" : "Free"}</CardTitle>
            <CardDescription className="mt-2">
              {summary.plan === "pro" ? `${summary.cadence === "year" ? "£120 yearly" : "£12 monthly"} · 100 AI credits per billing month` : "The complete workspace, with AI generation using your own provider key."}
            </CardDescription>
          </div>
          <Badge variant={recoverable ? "destructive" : "outline"}>{summary.status ?? "free"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {checkoutPending && (
          <div className="flex gap-3 border bg-secondary/45 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <div><p className="font-medium">Confirming your subscription</p><p className="mt-1 text-muted-foreground">Stripe is processing your checkout. Pro will appear here after confirmation.</p></div>
          </div>
        )}
        {creditsPurchased && (
          <div className="flex gap-3 border bg-secondary/45 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <div><p className="font-medium">Payment received</p><p className="mt-1 text-muted-foreground">Your credits appear here as soon as Stripe confirms the payment, usually within a few seconds. Refresh if they are not showing.</p></div>
          </div>
        )}
        {recoverable && (
          <div className="flex gap-3 border border-destructive/20 bg-destructive/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div><p className="font-medium">Your payment needs attention</p><p className="mt-1 text-muted-foreground">Hosted AI is paused. Update your billing details in Stripe to restore it.</p></div>
          </div>
        )}
        {summary.plan === "pro" && (
          <div className="space-y-3 border p-4">
            <div className="flex justify-between text-sm"><span>AI allowance</span><span>{summary.creditsUsed} used · {remaining} remaining</span></div>
            <div className="h-2 overflow-hidden bg-secondary" role="progressbar" aria-label="AI credits used" aria-valuemin={0} aria-valuemax={summary.creditLimit} aria-valuenow={summary.creditsUsed}>
              <div className="h-full bg-foreground" style={{ width: `${Math.min(100, summary.creditLimit ? summary.creditsUsed / summary.creditLimit * 100 : 0)}%` }} />
            </div>
            {summary.periodEnd && <p className="text-xs text-muted-foreground">{summary.cancelAtPeriodEnd ? "Pro ends" : "Allowance resets"} {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(summary.periodEnd))}.</p>}
          </div>
        )}
        {summary.plan === "pro" && !recoverable && (
          <div className="space-y-4 border p-4">
            <div>
              <div className="flex justify-between text-sm"><span>Extra credits</span><span>{summary.purchasedCredits} available</span></div>
              <p className="mt-1 text-xs text-muted-foreground">
                {outOfCredits ? "Your monthly allowance is used. Buy credits to keep going, or wait for it to reset." : "Used after your monthly allowance runs out. They never expire."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {summary.creditPacks.map((pack) => (
                <BillingActionButton key={pack.id} action="credits" pack={pack.id} variant={outOfCredits ? "default" : "outline"}>
                  {pack.credits} credits · {formatPounds(pack.amountPence)}
                </BillingActionButton>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {summary.plan === "pro" || recoverable ? (
            <BillingActionButton action="portal">Manage billing</BillingActionButton>
          ) : (
            <Link href="/pricing" className={buttonVariants()}>Upgrade to Pro</Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
