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
}))

import { createClient } from "@/lib/supabase/server"
import { aiGenerateRateLimit } from "@/lib/rate-limit"
import { generateText, resolveAiConfig } from "@/lib/ai"
import { loadInterviewQuestionById } from "@/app/(dashboard)/interview/data"
import { POST } from "./route"

const questionId = "11111111-1111-4111-8111-111111111111"

function request(responses: Array<{ prompt: string; answer: string }>) {
  return new Request("http://localhost/api/interview/discovery/draft", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ questionId, responses }),
  })
}

describe("POST /api/interview/discovery/draft", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { preferences: {} },
            }),
          }),
        }),
      }),
    } as never)
    vi.mocked(aiGenerateRateLimit.limit).mockResolvedValue({
      success: true,
    } as never)
    vi.mocked(loadInterviewQuestionById).mockResolvedValue({
      id: questionId,
      text: "Describe a conflict with a teammate.",
      category: "teamwork",
    } as never)
    vi.mocked(resolveAiConfig).mockReturnValue({
      settings: { provider: "openai", model: "gpt-4.1" },
      apiKey: "key",
    } as never)
    vi.mocked(generateText).mockResolvedValue(
      JSON.stringify({
        outcome: "story_found",
        story: {
          title: "Resolved a group-project disagreement",
          situation: "Two teammates disagreed about the approach.",
          task: "I helped the group reach a decision.",
          action: "I summarised both options and suggested a small test.",
          result: "We agreed on an approach and completed the project.",
          tags: ["teamwork", "conflict"],
        },
      }),
    )
  })

  it("rejects blank responses", async () => {
    const response = await POST(
      request([{ prompt: "What happened?", answer: "  " }]),
    )

    expect(response.status).toBe(400)
    expect(generateText).not.toHaveBeenCalled()
  })

  it("rejects a question that is not owned", async () => {
    vi.mocked(loadInterviewQuestionById).mockResolvedValue(null)

    const response = await POST(
      request([{ prompt: "What happened?", answer: "A real event." }]),
    )

    expect(response.status).toBe(404)
  })

  it("returns a reviewable draft without persisting it", async () => {
    const response = await POST(
      request([
        {
          prompt: "What did you personally do?",
          answer: "I summarised both options and proposed a small test.",
        },
      ]),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      outcome: "story_found",
      story: { title: "Resolved a group-project disagreement" },
    })
    expect(generateText).toHaveBeenCalledOnce()
  })
})
