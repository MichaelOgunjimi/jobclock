import { beforeEach, describe, expect, it, vi } from "vitest"

const { db, usage, ai } = vi.hoisted(() => ({
  db: { select: vi.fn() },
  usage: { reserveHostedAiAction: vi.fn(), settleHostedAiAction: vi.fn(), releaseHostedAiAction: vi.fn() },
  ai: { generateTextResult: vi.fn(), generateTextWithWebSearchResult: vi.fn(), resolveAiConfig: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/billing/usage", () => usage)
vi.mock("./index", () => ai)

import { runAiAction } from "./action"

const PERIOD = { currentPeriodStart: new Date("2026-10-01T00:00:00Z"), currentPeriodEnd: new Date("2026-11-01T00:00:00Z") }

function setSubscription(row: Record<string, unknown> | null) {
  db.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => (row ? [row] : []) }) }) })
}

const request = (preferences: Record<string, unknown> | null = null) =>
  ({ userId: "user-1", actionId: "action-1", feature: "cover_letter", preferences }) as never

describe("runAiAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("OPENAI_API_KEY", "platform-openai")
    vi.stubEnv("ANTHROPIC_API_KEY", "platform-anthropic")
    setSubscription({ status: "active", graceEndsAt: null, ...PERIOD })
    usage.reserveHostedAiAction.mockResolvedValue({ id: "row-1", status: "reserved" })
    ai.resolveAiConfig.mockReturnValue({ settings: { provider: "openai", model: "personal-model" }, apiKey: "personal-key" })
    ai.generateTextResult.mockResolvedValue({
      text: "hello", providerRequestId: "req-1", inputTokens: 1000, cachedInputTokens: 0, outputTokens: 500,
    })
  })

  it("uses the personal key without touching the allowance when billing source is personal", async () => {
    const result = await runAiAction(request({ ai_billing_source: "personal", openai_api_key: "enc" }), (client) => client.generate("s", "u"))

    expect(result).toBe("hello")
    expect(ai.resolveAiConfig).toHaveBeenCalledWith(expect.objectContaining({ allow_platform_ai_key: false }))
    expect(ai.generateTextResult).toHaveBeenCalledWith({ provider: "openai", model: "personal-model" }, "personal-key", "s", "u", undefined, undefined)
    expect(usage.reserveHostedAiAction).not.toHaveBeenCalled()
    expect(usage.settleHostedAiAction).not.toHaveBeenCalled()
  })

  it("uses a personal key by default for a free user who has one", async () => {
    setSubscription(null)
    await runAiAction(request({ openai_api_key: "enc" }), (client) => client.generate("s", "u"))
    expect(usage.reserveHostedAiAction).not.toHaveBeenCalled()
  })

  it("propagates the missing-key error for a free user without a key", async () => {
    setSubscription(null)
    ai.resolveAiConfig.mockImplementation(() => { throw new Error("No API key configured") })
    await expect(runAiAction(request(), (client) => client.generate("s", "u"))).rejects.toThrow("No API key configured")
    expect(usage.reserveHostedAiAction).not.toHaveBeenCalled()
  })

  it("reserves, calls the hosted model and settles recorded usage for a Pro user", async () => {
    const result = await runAiAction(request({ ai_billing_source: "jobclock" }), (client) => client.generate("s", "u"))

    expect(result).toBe("hello")
    expect(usage.reserveHostedAiAction).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      idempotencyKey: "action-1",
      feature: "cover_letter",
      credits: 4,
      period: expect.objectContaining({ start: PERIOD.currentPeriodStart, end: PERIOD.currentPeriodEnd }),
    }))
    expect(ai.generateTextResult).toHaveBeenCalledWith(
      { provider: "openai", model: "gpt-6.1-sol" }, "platform-openai", "s", "u", undefined, undefined,
    )
    // gpt-6.1-sol: 1000 in @ $2/M + 500 out @ $10/M = 7000 microUSD
    expect(usage.settleHostedAiAction).toHaveBeenCalledWith("row-1", [
      expect.objectContaining({ provider: "openai", model: "gpt-6.1-sol", providerRequestId: "req-1", totalCostMicrousd: 7000 }),
    ])
    expect(usage.releaseHostedAiAction).not.toHaveBeenCalled()
  })

  it("defaults a Pro user without a personal key to hosted, and honours the provider preference", async () => {
    await runAiAction(request({ hosted_provider_preference: "anthropic" }), (client) => client.generate("s", "u"))
    expect(ai.generateTextResult).toHaveBeenCalledWith(
      { provider: "anthropic", model: "claude-sonnet-5-5" }, "platform-anthropic", "s", "u", undefined, undefined,
    )
  })

  it("falls back to the personal key when a non-Pro user asks for hosted", async () => {
    setSubscription(null)
    await runAiAction(request({ ai_billing_source: "jobclock", openai_api_key: "enc" }), (client) => client.generate("s", "u"))
    expect(usage.reserveHostedAiAction).not.toHaveBeenCalled()
  })

  it("releases the reservation with incurred usage and rethrows when the operation fails", async () => {
    await expect(runAiAction(request(), async (client) => {
      await client.generate("s", "u")
      throw new Error("parse failed")
    })).rejects.toThrow("parse failed")

    expect(usage.settleHostedAiAction).not.toHaveBeenCalled()
    expect(usage.releaseHostedAiAction).toHaveBeenCalledWith("row-1", [expect.objectContaining({ totalCostMicrousd: 7000 })])
  })

  it("releases when the provider call itself fails", async () => {
    ai.generateTextResult.mockRejectedValue(new Error("timeout"))
    await expect(runAiAction(request(), (client) => client.generate("s", "u"))).rejects.toThrow("timeout")
    expect(usage.releaseHostedAiAction).toHaveBeenCalledWith("row-1", [])
  })

  it("does not call the provider when the allowance is exhausted", async () => {
    usage.reserveHostedAiAction.mockRejectedValue(new Error("Your JobClock AI allowance has been used"))
    const operation = vi.fn()
    await expect(runAiAction(request(), operation)).rejects.toThrow("allowance")
    expect(operation).not.toHaveBeenCalled()
    expect(usage.releaseHostedAiAction).not.toHaveBeenCalled()
  })

  it("refuses an action that was already completed", async () => {
    usage.reserveHostedAiAction.mockResolvedValue({ id: "row-1", status: "completed" })
    const operation = vi.fn()
    await expect(runAiAction(request(), operation)).rejects.toThrow("already been processed")
    expect(operation).not.toHaveBeenCalled()
  })

  it("fails before reserving when the platform key is not configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "")
    await expect(runAiAction(request(), (client) => client.generate("s", "u"))).rejects.toThrow("API key is not configured")
    expect(usage.reserveHostedAiAction).not.toHaveBeenCalled()
  })

  it("adds the web search tool cost to the settled usage", async () => {
    ai.generateTextWithWebSearchResult.mockResolvedValue({
      text: "research", inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, toolCostMicrousd: 50_000,
    })
    await runAiAction({ userId: "user-1", actionId: "action-1", feature: "company_research", preferences: null }, (client) => client.generateWithWebSearch("s", "u", 3500))

    expect(usage.settleHostedAiAction).toHaveBeenCalledWith("row-1", [
      expect.objectContaining({ toolCostMicrousd: 50_000, totalCostMicrousd: 50_000 }),
    ])
  })

  it("lets SDK-direct callers report usage through record()", async () => {
    await runAiAction(request(), async (client) => {
      expect(client.settings).toEqual({ provider: "openai", model: "gpt-6.1-sol" })
      client.record({ text: "", inputTokens: 2000, cachedInputTokens: 0, outputTokens: 0 })
    })
    expect(usage.settleHostedAiAction).toHaveBeenCalledWith("row-1", [expect.objectContaining({ totalCostMicrousd: 4000 })])
  })

  it("uses the calendar month for a staff-override user with no subscription", async () => {
    setSubscription(null)
    await runAiAction(request({ allow_platform_ai_key: true }), (client) => client.generate("s", "u"))
    const { period } = usage.reserveHostedAiAction.mock.calls[0][0]
    expect(period.start.getUTCDate()).toBe(1)
    expect(period.end.getTime()).toBeGreaterThan(period.start.getTime())
  })
})
