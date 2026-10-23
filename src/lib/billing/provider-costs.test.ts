import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { AI_PRICE_VERSION, calculateProviderCostMicrousd } from "./provider-costs"

describe("provider cost calculation", () => {
  it("uses the versioned substantive-model price", () => {
    expect(calculateProviderCostMicrousd({
      model: "gpt-6.1-sol",
      inputTokens: 1_000,
      outputTokens: 500,
    })).toBe(7_000)
  })

  it("uses the low-cost model price and adds tool costs", () => {
    expect(calculateProviderCostMicrousd({
      model: "claude-haiku-5-5",
      inputTokens: 10_000,
      cachedInputTokens: 5_000,
      outputTokens: 2_000,
      toolCostMicrousd: 250,
    })).toBe(2_250)
    expect(AI_PRICE_VERSION).toBe("2026-10-22")
  })
})
