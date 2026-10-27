import "server-only"

export const AI_PRICE_VERSION = "2026-10-22"

const PRICES_MICROUSD_PER_MILLION_TOKENS = {
  "gpt-6.1-sol": { input: 2_000_000, output: 10_000_000 },
  "claude-sonnet-5-5": { input: 2_000_000, output: 10_000_000 },
  "gpt-6-luna": { input: 100_000, output: 500_000 },
  "claude-haiku-5-5": { input: 100_000, output: 500_000 },
} as const

export type HostedModel = keyof typeof PRICES_MICROUSD_PER_MILLION_TOKENS

export function calculateProviderCostMicrousd(input: {
  model: HostedModel
  inputTokens: number
  cachedInputTokens?: number
  outputTokens: number
  toolCostMicrousd?: number
}) {
  const price = PRICES_MICROUSD_PER_MILLION_TOKENS[input.model]
  const uncachedInputTokens = Math.max(0, input.inputTokens - (input.cachedInputTokens ?? 0))
  // Cached-token discounts vary by provider; charging the input rate is deliberately conservative.
  return Math.ceil(
    (uncachedInputTokens * price.input
      + (input.cachedInputTokens ?? 0) * price.input
      + input.outputTokens * price.output) / 1_000_000,
  ) + (input.toolCostMicrousd ?? 0)
}
