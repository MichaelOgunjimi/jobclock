import { beforeEach, describe, expect, it, vi } from "vitest"

const { runAiAction, reviewCv } = vi.hoisted(() => ({ runAiAction: vi.fn(), reviewCv: vi.fn() }))
vi.mock("@/lib/db", async () => ({ db: (await import("@/lib/mcp/fake-db")).fakeDb }))
vi.mock("@/lib/ai/action", () => ({ runAiAction }))
vi.mock("@/lib/ai/cv-review", () => ({ reviewCv }))
vi.mock("@/lib/ai", () => ({ withPlatformAiKeyAccess: (preferences: object, allow: boolean) => ({ ...preferences, allow_platform_ai_key: allow }) }))

import { expectAllQueriesScopedTo, recorded, resetFakeDb, type RecordedQuery } from "@/lib/mcp/fake-db"
import { reviewSavedCvForUser } from "./review-service"

const OWNER = "11111111-1111-4111-8111-111111111111"
const INTRUDER = "22222222-2222-4222-8222-222222222222"
const CV = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const FINDINGS = [{ category: "weak_verb", severity: "low", message: "m", suggestion: "s" }]

beforeEach(() => {
  runAiAction.mockReset().mockImplementation((_request, operation) => operation({}))
  reviewCv.mockReset().mockResolvedValue(FINDINGS)
  resetFakeDb(({ sql, params }: RecordedQuery) => {
    if (!params.includes(OWNER)) return []
    if (/from "user_cvs"/.test(sql)) return [[{ summary: "Dev", skills: [] }]]
    if (/from "profiles"/.test(sql)) return [[{ ai_billing_source: "jobclock" }, true]]
    return []
  })
})

describe("reviewSavedCvForUser", () => {
  it("runs one metered cv_review action over the saved CV with the caller's billing key, then stores the findings", async () => {
    const result = await reviewSavedCvForUser({ userId: OWNER, cvId: CV, actionId: "mcp:tok-1:cv_review:x:1" })
    expect(result).toEqual({ findings: FINDINGS })
    expect(runAiAction).toHaveBeenCalledTimes(1)
    expect(runAiAction).toHaveBeenCalledWith(
      { userId: OWNER, actionId: "mcp:tok-1:cv_review:x:1", feature: "cv_review", preferences: { ai_billing_source: "jobclock", allow_platform_ai_key: true } },
      expect.any(Function),
    )
    expect(reviewCv).toHaveBeenCalledTimes(1)
    const update = recorded.find((query) => /^update "user_cvs"/.test(query.sql))!
    expect(update.params).toEqual(expect.arrayContaining([JSON.stringify(FINDINGS), CV, OWNER]))
    expectAllQueriesScopedTo(OWNER, [INTRUDER])
  })

  it("returns null for a CV that is not the caller's, and spends and stores nothing", async () => {
    expect(await reviewSavedCvForUser({ userId: INTRUDER, cvId: CV, actionId: "k" })).toBeNull()
    expect(runAiAction).not.toHaveBeenCalled()
    expect(recorded.some((query) => /^update/i.test(query.sql))).toBe(false)
    expectAllQueriesScopedTo(INTRUDER, [OWNER])
  })

  it("does not store findings when the metered action fails (so nothing is charged twice or half-saved)", async () => {
    runAiAction.mockRejectedValue(new Error("allowance used"))
    await expect(reviewSavedCvForUser({ userId: OWNER, cvId: CV, actionId: "k" })).rejects.toThrow("allowance used")
    expect(recorded.some((query) => /^update/i.test(query.sql))).toBe(false)
  })
})
