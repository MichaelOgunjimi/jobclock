import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({
  aiGenerateRateLimit: { limit: vi.fn() },
}))
vi.mock("@/lib/ai", () => ({
  resolveAiConfig: vi.fn(),
  generateText: vi.fn(),
  withPlatformAiKeyAccess: vi.fn((preferences, allowPlatformAiKey) => ({
    ...(preferences ?? {}),
    allow_platform_ai_key: Boolean(allowPlatformAiKey),
  })),
}))
vi.mock("@/app/(dashboard)/interview/data", () => ({
  loadInterviewAnswers: vi.fn(),
  loadInterviewApplicationById: vi.fn(),
  loadInterviewQuestionById: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"
import { aiGenerateRateLimit } from "@/lib/rate-limit"
import { generateText, resolveAiConfig } from "@/lib/ai"
import {
  loadInterviewAnswers,
  loadInterviewApplicationById,
  loadInterviewQuestionById,
} from "@/app/(dashboard)/interview/data"
import { POST } from "./route"

const questionId = "11111111-1111-4111-8111-111111111111"
const applicationId = "22222222-2222-4222-8222-222222222222"

function request(body: unknown) {
  return new Request("http://localhost/api/interview/practice/evaluate", {
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

describe("POST /api/interview/practice/evaluate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthenticatedUser()
    vi.mocked(aiGenerateRateLimit.limit).mockResolvedValue({ success: true } as never)
    vi.mocked(loadInterviewQuestionById).mockResolvedValue({
      id: questionId,
      userId: "user-1",
      applicationId: null,
      text: "Tell me about a time you worked under pressure.",
      category: "adaptability",
      sourceType: "custom",
      sourceRef: "pressure",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never)
    vi.mocked(loadInterviewApplicationById).mockResolvedValue({
      id: applicationId,
      title: "Junior Software Engineer",
      company: "OneFamily",
      description: "Build TypeScript services.",
      researchContent: "OneFamily is modernising member-facing financial products.",
      createdAt: new Date(),
    } as never)
    vi.mocked(loadInterviewAnswers).mockResolvedValue([
      {
        id: "answer-1",
        questionId,
        applicationId,
        content: "My saved answer uses the JobClock launch story.",
        evidenceSnapshot: null,
        status: "saved",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never)
    vi.mocked(resolveAiConfig).mockReturnValue({
      settings: { provider: "openai", model: "gpt-4.1" },
      apiKey: "key",
    } as never)
    vi.mocked(generateText).mockResolvedValue("### What worked\n- Clear example.")
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuthenticatedUser(null)

    const response = await POST(request({ questionId, answer: "My answer" }))

    expect(response.status).toBe(401)
  })

  it("evaluates practice answers with selected application research and saved answer context", async () => {
    const response = await POST(request({
      questionId,
      applicationId,
      answer: "I stayed calm and shipped the fix.",
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      feedback: "### What worked\n- Clear example.",
    })
    expect(generateText).toHaveBeenCalledOnce()
    const userPrompt = vi.mocked(generateText).mock.calls[0]?.[3] as string
    expect(userPrompt).toContain("Junior Software Engineer")
    expect(userPrompt).toContain("OneFamily is modernising member-facing financial products.")
    expect(userPrompt).toContain("My saved answer uses the JobClock launch story.")
  })

  it("returns 404 when a selected application is not owned", async () => {
    vi.mocked(loadInterviewApplicationById).mockResolvedValue(null)

    const response = await POST(request({
      questionId,
      applicationId,
      answer: "My answer",
    }))

    expect(response.status).toBe(404)
  })
})
