import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({
  cvGenerateRateLimit: { limit: vi.fn() },
}))
vi.mock("@/lib/ai", () => ({
  resolveAiConfig: vi.fn(),
  generateText: vi.fn(),
}))
vi.mock("@/lib/ai/prompts", () => ({
  STAGE_B_SYSTEM_PROMPT: "stage-b",
  buildStageBUserPrompt: vi.fn(),
  STAGE_C_SYSTEM_PROMPT: "stage-c",
  buildStageCUserPrompt: vi.fn(),
  STAGE_D_SYSTEM_PROMPT: "stage-d",
  buildStageDUserPrompt: vi.fn(),
  STAGE_E_SYSTEM_PROMPT: "stage-e",
  buildStageEUserPrompt: vi.fn(),
}))
vi.mock("@/lib/ai/extract-json", () => ({ extractJson: vi.fn() }))
vi.mock("@/lib/ai/cv-tailoring-schemas", () => ({
  jobAnalysisSchema: { safeParse: vi.fn() },
  cvMatchAnalysisSchema: { safeParse: vi.fn() },
  cvTailoringPlanSchema: { safeParse: vi.fn() },
  tailoredCvResultSchema: { safeParse: vi.fn() },
  cvDataSchema: { safeParse: vi.fn() },
}))

import { createClient } from "@/lib/supabase/server"
import { cvGenerateRateLimit } from "@/lib/rate-limit"
import { resolveAiConfig } from "@/lib/ai"
import { POST } from "./route"

function createRequest(): NextRequest {
  return new NextRequest("http://localhost/api/applications/app-1/cv/generate", { method: "POST" })
}

describe("POST /api/applications/[id]/cv/generate", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()

    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(cvGenerateRateLimit.limit).mockResolvedValue({
      success: true,
      reset: Date.now() + 60_000,
    } as never)
    vi.mocked(resolveAiConfig).mockReturnValue({
      settings: { provider: "openai", model: "gpt-4o-mini" },
      apiKey: "test-api-key",
    })

    supabaseMock.setQueryResult("applications.select.single", {
      data: {
        id: "app-1",
        user_id: "test-user-id",
        customized_cv_id: null,
        custom_description: "Custom job description",
        jobs_cache: {
          description: "Job description",
          title: "Software Engineer",
          company: "Acme",
          location: "London",
        },
      },
    })
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: {} },
    })
    supabaseMock.setQueryResult("user_cvs.select.maybeSingle", {
      data: { id: "cv-1" },
    })
    supabaseMock.setQueryResult("user_cvs.select.single", {
      data: { parsed_json: { name: "Test User" } },
    })
  })

  it("returns 401 when not authenticated", async () => {
    supabaseMock.setUser(null)

    const response = await POST(createRequest(), { params: Promise.resolve({ id: "app-1" }) })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(cvGenerateRateLimit.limit).mockResolvedValue({
      success: false,
      reset: Date.now() + 60_000,
    } as never)

    const response = await POST(createRequest(), { params: Promise.resolve({ id: "app-1" }) })
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body).toEqual({
      error: "Rate limit reached. Please wait a moment before generating another CV.",
    })
  })

  it("returns 404 when application not found", async () => {
    supabaseMock.setQueryResult("applications.select.single", { data: null })

    const response = await POST(createRequest(), { params: Promise.resolve({ id: "app-1" }) })
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: "Application not found" })
  })

  it("returns 422 when no primary CV found", async () => {
    supabaseMock.setQueryResult("user_cvs.select.maybeSingle", { data: null })

    const response = await POST(createRequest(), { params: Promise.resolve({ id: "app-1" }) })
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({ error: "No CV found. Upload a CV first." })
  })

  it("returns 422 when AI config fails", async () => {
    vi.mocked(resolveAiConfig).mockImplementation(() => {
      throw new Error("No API key configured.")
    })

    const response = await POST(createRequest(), { params: Promise.resolve({ id: "app-1" }) })
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({ error: "No API key configured." })
  })
})
