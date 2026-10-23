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
  allowanceWindow,
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

describe("allowanceWindow", () => {
  const d = (iso: string) => new Date(iso)

  it("keeps a monthly subscription's whole period as its window", () => {
    expect(allowanceWindow(d("2026-10-23T02:00:00Z"), d("2026-11-23T02:00:00Z"), d("2026-11-01T00:00:00Z")))
      .toEqual({ start: d("2026-10-23T02:00:00Z"), end: d("2026-11-23T02:00:00Z") })
  })

  it("gives a yearly subscriber a fresh window each month", () => {
    const start = d("2026-10-23T02:00:00Z")
    const end = d("2027-10-23T02:00:00Z")
    expect(allowanceWindow(start, end, d("2026-11-22T00:00:00Z")).end).toEqual(d("2026-11-23T02:00:00Z"))
    expect(allowanceWindow(start, end, d("2026-11-23T02:00:00Z")))
      .toEqual({ start: d("2026-11-23T02:00:00Z"), end: d("2026-12-23T02:00:00Z") })
    expect(allowanceWindow(start, end, d("2027-10-22T00:00:00Z")))
      .toEqual({ start: d("2027-09-23T02:00:00Z"), end: end })
  })

  it("clamps month-end anchors instead of overflowing into the next month", () => {
    expect(allowanceWindow(d("2026-01-31T00:00:00Z"), d("2027-01-31T00:00:00Z"), d("2026-02-28T00:00:00Z")))
      .toEqual({ start: d("2026-02-28T00:00:00Z"), end: d("2026-03-31T00:00:00Z") })
  })
})
