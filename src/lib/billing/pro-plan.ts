// Pro plan facts that client components display. Kept free of server-only code so dialogs can import them.
export const PRO_CREDIT_LIMIT = 300

export const PRO_PRICES = {
  monthly: { amountPence: 1_200, interval: "month" },
  annual: { amountPence: 12_000, interval: "year" },
} as const

export type BillingCadence = keyof typeof PRO_PRICES
