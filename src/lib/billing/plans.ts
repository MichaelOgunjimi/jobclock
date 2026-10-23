import "server-only"

export const PRO_CREDIT_LIMIT = 100
export const PRO_COST_LIMIT_MICROUSD = 4_000_000

export const PRO_PRICES = {
  monthly: { amountPence: 1_200, interval: "month" },
  annual: { amountPence: 12_000, interval: "year" },
} as const

export type BillingCadence = keyof typeof PRO_PRICES

// One-off top-ups for Pro subscribers. Priced above the Pro rate (£0.12 a credit) so subscribing stays the better deal.
export const CREDIT_PACKS = {
  credits_50: { credits: 50, amountPence: 750 },
  credits_150: { credits: 150, amountPence: 2_100 },
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
  company_research: 6,
  cv_tailoring: 10,
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

/** The monthly credit window inside a Stripe period, so a yearly subscriber gets 100 credits a month, not 100 a year. */
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
