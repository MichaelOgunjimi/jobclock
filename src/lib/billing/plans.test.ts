import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import {
  AI_CREDIT_WEIGHTS,
  getCreditWeight,
  getHostedModel,
  getProPriceId,
  isHostedModel,
  PREMIUM_PERSONAL_KEY_MODELS,
  PRO_COST_LIMIT_MICROUSD,
  PRO_CREDIT_LIMIT,
  PRO_PRICES,
} from "./plans"

describe("billing plan configuration", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it("defines the approved prices and limits", () => {
    expect(PRO_PRICES).toEqual({
      monthly: { amountPence: 1_200, interval: "month" },
      annual: { amountPence: 12_000, interval: "year" },
    })
    expect(PRO_CREDIT_LIMIT).toBe(100)
    expect(PRO_COST_LIMIT_MICROUSD).toBe(4_000_000)
  })

  it("charges the fixed weight for every AI feature", () => {
    expect(AI_CREDIT_WEIGHTS).toEqual({
      job_import: 1,
      qualification_document_extraction: 2,
      cv_parse_review: 5,
      application_chat: 2,
      interview_answer: 2,
      interview_preparation: 4,
      cover_letter: 4,
      company_research: 6,
      cv_tailoring: 10,
    })
    expect(getCreditWeight("cv_tailoring")).toBe(10)
  })

  it("maps cadence only to server-owned Price IDs", () => {
    vi.stubEnv("STRIPE_PRO_MONTHLY_PRICE_ID", "price_monthly")
    vi.stubEnv("STRIPE_PRO_ANNUAL_PRICE_ID", "price_annual")
    expect(getProPriceId("monthly")).toBe("price_monthly")
    expect(getProPriceId("annual")).toBe("price_annual")
  })

  it("fails closed when a Price ID is missing", () => {
    vi.stubEnv("STRIPE_PRO_MONTHLY_PRICE_ID", "")
    expect(() => getProPriceId("monthly")).toThrow("not configured")
  })

  it("routes extraction cheaply and substantive work to the standard model", () => {
    expect(getHostedModel("job_import")).toEqual({ provider: "openai", model: "gpt-6-luna" })
    expect(getHostedModel("cover_letter", "anthropic")).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-5-5",
    })
  })

  it("keeps premium models personal-key only", () => {
    expect(PREMIUM_PERSONAL_KEY_MODELS).toEqual([
      "gpt-6-astra",
      "claude-opus-5-5",
      "claude-fable-5-1",
    ])
    for (const model of PREMIUM_PERSONAL_KEY_MODELS) expect(isHostedModel(model)).toBe(false)
    expect(isHostedModel("gpt-6.1-sol")).toBe(true)
  })
})
