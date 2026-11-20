import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({ aiGenerateRateLimit: { limit: vi.fn() } }))
vi.mock("@/lib/ai/action", () => ({ runAiAction: vi.fn() }))
vi.mock("@/lib/ai/cv-review", () => ({ reviewCv: vi.fn() }))
vi.mock("@/lib/billing/usage", () => ({ AiAllowanceExhaustedError: class extends Error { code = "ai_allowance_exhausted" } }))
vi.mock("@/lib/ai", () => ({
  MissingAiApiKeyError: class extends Error { code = "missing_ai_api_key" },
  withPlatformAiKeyAccess: vi.fn((preferences) => preferences),
}))

import { createClient } from "@/lib/supabase/server"
import { aiGenerateRateLimit } from "@/lib/rate-limit"
import { runAiAction } from "@/lib/ai/action"
import { reviewCv } from "@/lib/ai/cv-review"
import { AiAllowanceExhaustedError } from "@/lib/billing/usage"
import { POST } from "./route"

const parsedJson = { summary: "Dev", education: [], skills: [] }
const updateEq = vi.fn()
const update = vi.fn()
const cvLookup = vi.fn()

function mockSupabase(user: { id: string } | null) {
  update.mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: updateEq }) })
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) =>
      table === "profiles"
        ? { select: () => ({ eq: () => ({ single: async () => ({ data: { preferences: {} } }) }) }) }
        : { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: cvLookup }) }) }), update },
    ),
  } as never)
}

const call = () => POST(new Request("http://localhost/api/cv/cv-1/review", { method: "POST" }), { params: Promise.resolve({ id: "cv-1" }) })

describe("POST /api/cv/[id]/review", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase({ id: "user-1" })
    cvLookup.mockResolvedValue({ data: { parsed_json: parsedJson } })
    updateEq.mockResolvedValue({ error: null })
    vi.mocked(aiGenerateRateLimit.limit).mockResolvedValue({ success: true } as never)
    vi.mocked(reviewCv).mockResolvedValue([])
    vi.mocked(runAiAction).mockImplementation((_request, operation) => operation({} as never))
  })

  it("requires a signed-in user", async () => {
    mockSupabase(null)
    expect((await call()).status).toBe(401)
    expect(runAiAction).not.toHaveBeenCalled()
  })

  it("rate limits before spending anything", async () => {
    vi.mocked(aiGenerateRateLimit.limit).mockResolvedValue({ success: false } as never)
    expect((await call()).status).toBe(429)
    expect(runAiAction).not.toHaveBeenCalled()
  })

  it("404s for a CV that is not the user's", async () => {
    cvLookup.mockResolvedValue({ data: null })
    expect((await call()).status).toBe(404)
    expect(runAiAction).not.toHaveBeenCalled()
  })

  it("reviews the saved CV as a metered cv_review action and stores the findings", async () => {
    const findings = [{ category: "weak_verb", severity: "low", location: { section: "summary" }, message: "m", suggestion: "s" }]
    vi.mocked(reviewCv).mockResolvedValue(findings as never)

    const response = await call()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ findings })
    expect(runAiAction).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", feature: "cv_review" }), expect.any(Function))
    expect(vi.mocked(reviewCv).mock.calls[0][0]).toMatchObject({ summary: "Dev", experience: [] })
    expect(update).toHaveBeenCalledWith({ review_findings: findings })
  })

  it("still returns the paid-for findings when storing them fails", async () => {
    updateEq.mockResolvedValue({ error: { message: "db down" } })
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect((await call()).status).toBe(200)
  })

  it("maps an exhausted allowance to 402 and other failures to 502", async () => {
    vi.mocked(runAiAction).mockRejectedValueOnce(new AiAllowanceExhaustedError(new Date()))
    expect((await call()).status).toBe(402)
    vi.mocked(runAiAction).mockRejectedValueOnce(new Error("boom"))
    expect((await call()).status).toBe(502)
  })
})
