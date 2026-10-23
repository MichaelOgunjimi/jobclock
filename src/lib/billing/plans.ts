import "server-only"

import { PRO_CREDIT_LIMIT, PRO_PRICES, type BillingCadence } from "./pro-plan"

export { PRO_CREDIT_LIMIT, PRO_PRICES }
export type { BillingCadence }

export const PRO_COST_LIMIT_MICROUSD = 6_000_000

// One-off top-ups for Pro subscribers. Priced well above the Pro rate (£0.04 a credit) so subscribing stays the better deal.
export const CREDIT_PACKS = {
  credits_50: { credits: 50, amountPence: 400 },
  credits_150: { credits: 150, amountPence: 1_000 },
} as const

export type CreditPackId = keyof typeof CREDIT_PACKS

export const AI_CREDIT_WEIGHTS = {
  job_import: 1,
  qualification_document_extraction: 2,
  cv_parse_review: 5,
  application_chat: 2,
  interview_answer: 2,
  interview_preparation: 4,
  cover_letter: 4,
  company_research: 8,
  cv_tailoring: 6,
} as const

export type AiFeature = keyof typeof AI_CREDIT_WEIGHTS
export type HostedProviderPreference = "automatic" | "openai" | "anthropic"
export type HostedProvider = Exclude<HostedProviderPreference, "automatic">

const LOW_COST_FEATURES: ReadonlySet<AiFeature> = new Set([
  "job_import",
  "qualification_document_extraction",
  "cv_parse_review",
])

export const HOSTED_MODELS = {
  openai: { lowCost: "gpt-6-luna", substantive: "gpt-6.1-sol" },
  anthropic: { lowCost: "claude-haiku-5-5", substantive: "claude-sonnet-5-5" },
} as const

export const PREMIUM_PERSONAL_KEY_MODELS = [
  "gpt-6-astra",
  "claude-opus-5-5",
  "claude-fable-5-1",
] as const

function addMonths(date: Date, months: number) {
  const result = new Date(date)
  const day = result.getUTCDate()
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDay))
  return result
}

/** The monthly credit window inside a Stripe period, so a yearly subscriber gets a full allowance every month, not one for the whole year. */
export function allowanceWindow(periodStart: Date, periodEnd: Date, now = new Date()) {
  let month = 0
  while (addMonths(periodStart, month + 1) <= now && addMonths(periodStart, month + 1) < periodEnd) month += 1
  const end = addMonths(periodStart, month + 1)
  return { start: addMonths(periodStart, month), end: end < periodEnd ? end : periodEnd }
}

export function getCreditWeight(feature: AiFeature) {
  return AI_CREDIT_WEIGHTS[feature]
}

export function getProPriceId(cadence: BillingCadence) {
  const priceId = cadence === "monthly"
    ? process.env.STRIPE_PRO_MONTHLY_PRICE_ID
    : process.env.STRIPE_PRO_ANNUAL_PRICE_ID

  if (!priceId) throw new Error(`Stripe Pro ${cadence} Price ID is not configured`)
  return priceId
}

export function getHostedModel(
  feature: AiFeature,
  preference: HostedProviderPreference = "automatic",
) {
  const provider: HostedProvider = preference === "automatic" ? "openai" : preference
  const tier = LOW_COST_FEATURES.has(feature) ? "lowCost" : "substantive"
  return { provider, model: HOSTED_MODELS[provider][tier] }
}

export function isHostedModel(model: string) {
  return Object.values(HOSTED_MODELS).some(
    ({ lowCost, substantive }) => model === lowCost || model === substantive,
  )
}
