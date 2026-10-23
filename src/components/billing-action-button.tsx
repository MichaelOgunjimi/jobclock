"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function BillingActionButton({
  action,
  cadence,
  pack,
  flow,
  variant,
  children,
  className,
}: {
  action: "checkout" | "portal" | "credits"
  cadence?: "monthly" | "annual"
  pack?: string
  /** Portal only: open Stripe straight on the cancel or change-plan screen. */
  flow?: "cancel" | "switch"
  variant?: React.ComponentProps<typeof Button>["variant"]
  children: React.ReactNode
  className?: string
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/billing/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "checkout" ? JSON.stringify({ cadence }) : action === "credits" ? JSON.stringify({ pack }) : flow ? JSON.stringify({ flow }) : undefined,
      })
      const result = await response.json() as { url?: string; error?: string }
      if (!response.ok || !result.url) throw new Error(result.error ?? "Billing is unavailable right now.")
      window.location.assign(result.url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Billing is unavailable right now.")
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant={variant} className={className} disabled={pending} onClick={handleClick}>
        {pending ? "Opening Stripe…" : children}
      </Button>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
