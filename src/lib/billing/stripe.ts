import "server-only"

import { randomInt } from "node:crypto"
import Stripe from "stripe"

let client: Stripe | undefined

export function getStripe(): Stripe {
  const apiKey = process.env.STRIPE_RESTRICTED_KEY
  if (!apiKey) throw new Error("STRIPE_RESTRICTED_KEY is not configured")
  return client ??= new Stripe(apiKey, { apiVersion: "2026-09-30.endive" })
}

// Where Stripe sends the user back to. The configured domain wins, even on a Vercel preview, so a
// deployment served from its own domain (staging.jobclock.dev) does not bounce users to a
// *.vercel.app host where they are signed out. Only a preview without one uses its own URL.
export function getBillingOrigin(): string {
  const previewUrl = process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
  const value = process.env.NEXT_PUBLIC_APP_URL || previewUrl || process.env.APP_URL
  if (!value) throw new Error("Application origin is not configured")
  return new URL(value).origin
}

export function checkoutIntegrationIdentifier(): string {
  let suffix = ""
  for (let index = 0; index < 8; index += 1) {
    suffix += String.fromCharCode(97 + randomInt(26))
  }
  return `jobclock_${suffix}`
}

