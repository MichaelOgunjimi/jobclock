import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({
  aiGenerateRateLimit: { limit: vi.fn() },
}))
vi.mock("@/lib/ai", () => ({
  resolveAiConfig: vi.fn(),
  generateText: vi.fn(),
}))
vi.mock("@/app/(dashboard)/interview/data", () => ({
  loadInterviewQuestionById: vi.fn(),
  loadInterviewApplicationById: vi.fn(),
  loadInterviewFacts: vi.fn(),
  loadInterviewStories: vi.fn(),
  loadPrimaryInterviewCvDrafts: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"
import { aiGenerateRateLimit } from "@/lib/rate-limit"
import { generateText, resolveAiConfig } from "@/lib/ai"
import {
  loadInterviewApplicationById,
  loadInterviewFacts,
  loadInterviewQuestionById,
  loadInterviewStories,
  loadPrimaryInterviewCvDrafts,
} from "@/app/(dashboard)/interview/data"
import { POST } from "./route"

const questionId = "11111111-1111-4111-8111-111111111111"
const applicationId = "22222222-2222-4222-8222-222222222222"

function request(body: unknown) {
  return new Request("http://localhost/api/interview/answers/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function mockAuthenticatedUser(user: { id: string } | null = { id: "user-1" }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { preferences: {} } }),
        }),
      }),
    }),
  } as never)
}

function mockOpeningEvidence() {
  vi.mocked(loadInterviewFacts).mockResolvedValue([
    {
      id: "fact-1",
      category: "summary",
      label: "Current focus",
      detail: "Building practical AI products.",
      sourceType: "manual",
      sourceRef: null,
      confirmedAt: new Date("2026-06-01T00:00:00.000Z"),
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    },
    {
      id: "fact-2",
      category: "experience",
      label: "Recent project",
      detail: "Built JobClock with Next.js.",
      sourceType: "manual",
      sourceRef: null,
      confirmedAt: new Date("2026-06-01T00:00:00.000Z"),
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    },
  ] as never)
  vi.mocked(loadInterviewStories).mockResolvedValue([])
  vi.mocked(loadPrimaryInterviewCvDrafts).mockResolvedValue([])
}

describe("POST /api/interview/answers/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticatedUser()
    vi.mocked(aiGenerateRateLimit.limit).mockResolvedValue({ success: true } as never)
    vi.mocked(loadInterviewQuestionById).mockResolvedValue({
      id: questionId,
      userId: "user-1",
      applicationId: null,
      text: "Tell me about yourself.",
      category: "opening",
      sourceType: "custom",
      sourceRef: "tell-me-about-yourself",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
    mockOpeningEvidence()
    vi.mocked(resolveAiConfig).mockReturnValue({
      settings: { provider: "openai", model: "gpt-4.1" },
      apiKey: "key",
    } as never)
    vi.mocked(generateText).mockResolvedValue("  I build practical AI products.  ")
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthenticatedUser(null)

    const response = await POST(request({ questionId }))

    expect(response.status).toBe(401)
  })

  it("returns 404 when the question is not owned", async () => {
    vi.mocked(loadInterviewQuestionById).mockResolvedValue(null)

    const response = await POST(request({ questionId }))

    expect(response.status).toBe(404)
  })

  it("returns missing-evidence prompts without calling AI", async () => {
    vi.mocked(loadInterviewQuestionById).mockResolvedValue({
      id: questionId,
      userId: "user-1",
      applicationId: null,
      text: "Describe a conflict with a teammate.",
      category: "teamwork",
      sourceType: "custom",
      sourceRef: "team-conflict",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
    vi.mocked(loadInterviewFacts).mockResolvedValue([])

    const response = await POST(request({ questionId }))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      status: "needs_evidence",
      reason: "story_required",
      suggestedPrompts: expect.any(Array),
    })
    expect(generateText).not.toHaveBeenCalled()
  })

  it("returns 404 when a tailored application is not owned", async () => {
    vi.mocked(loadInterviewApplicationById).mockResolvedValue(null)

    const response = await POST(request({ questionId, applicationId }))

    expect(response.status).toBe(404)
  })

  it("returns 422 when no AI key is configured", async () => {
    vi.mocked(resolveAiConfig).mockImplementation(() => {
      throw new Error("No AI API key configured")
    })

    const response = await POST(request({ questionId }))

    expect(response.status).toBe(422)
  })

  it("returns an unsaved grounded answer and evidence snapshot", async () => {
    const response = await POST(request({ questionId }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      content: "I build practical AI products.",
      evidenceSnapshot: {
        factIds: expect.arrayContaining(["fact-1", "fact-2"]),
        storyIds: [],
      },
    })
    expect(generateText).toHaveBeenCalledOnce()
  })
})
