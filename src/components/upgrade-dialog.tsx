"use client"

import Link from "next/link"
import { useState } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { Check, X } from "lucide-react"
import { BillingActionButton } from "@/components/billing-action-button"
import { PRO_CREDIT_LIMIT, PRO_PRICES, type BillingCadence } from "@/lib/billing/pro-plan"
import { formatPounds } from "@/lib/format-pounds"
import { cn } from "@/lib/utils"

const benefits = [
  `${PRO_CREDIT_LIMIT} JobClock AI credits every month`,
  "AI generation without a separate provider account",
  "Buy extra credits any time; they never expire",
  "Cancel whenever you like from Settings → Billing",
]

/** Opens the Pro upgrade in place so signed-in users never leave the page they are on. The trigger is styled by the caller. */
export function UpgradeDialog({ className, children }: { className?: string; children: React.ReactNode }) {
  const [cadence, setCadence] = useState<BillingCadence>("monthly")
  const price = PRO_PRICES[cadence]

  return (
    <Dialog.Root>
      <Dialog.Trigger className={className}>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 opacity-100 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Popup className="w-full max-w-md translate-y-0 scale-100 border border-border bg-background opacity-100 shadow-lg transition-[opacity,translate,scale] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-[ending-style]:translate-y-2 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:translate-y-2 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 motion-reduce:transition-none">
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <Dialog.Title className="text-sm font-medium">Upgrade to JobClock Pro</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                  Let JobClock handle AI for you, with a monthly allowance of credits.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Close" className="text-muted-foreground transition-colors hover:text-foreground">
                <X className="size-4" />
              </Dialog.Close>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="flex w-fit border bg-background p-1" role="group" aria-label="Billing cadence">
                {(["monthly", "annual"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={cadence === value}
                    onClick={() => setCadence(value)}
                    className={cn("px-3 py-1.5 text-sm capitalize transition-colors", cadence === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                  >
                    {value}{value === "annual" ? " · 2 months free" : ""}
                  </button>
                ))}
              </div>

              <p className="font-heading text-3xl">
                {formatPounds(price.amountPence)}
                <span className="ml-1 text-sm text-muted-foreground">/{price.interval}</span>
              </p>

              <ul className="space-y-2.5 text-sm">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0" />{benefit}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 border-t border-border px-5 py-4">
              <BillingActionButton action="checkout" cadence={cadence} returnToCurrentPage className="w-full">
                Continue to secure checkout
              </BillingActionButton>
              <p className="text-center text-xs text-muted-foreground">
                The price you see is the price you pay. No VAT is added.{" "}
                <Link href="/pricing" className="underline underline-offset-2">Compare plans</Link>
              </p>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
