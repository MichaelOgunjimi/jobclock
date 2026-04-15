import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({
  chatRateLimit: { limit: vi.fn() },
}))
vi.mock("@/lib/ai", () => ({
  resolveAiConfig: vi.fn(),
}))
vi.mock("@/lib/ai/prompts", () => ({
  buildChatAssistantSystemPrompt: vi.fn().mockReturnValue("system prompt"),
}))
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"
import { chatRateLimit } from "@/lib/rate-limit"
import { resolveAiConfig } from "@/lib/ai"
import Anthropic from "@anthropic-ai/sdk"
import { POST } from "./route"

function createChatRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/chat/application", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/chat/application", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>
  let anthropicStreamMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(chatRateLimit.limit).mockResolvedValue({ success: true } as never)
    vi.mocked(resolveAiConfig).mockReturnValue({
      settings: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
      apiKey: "test-key",
    })

    supabaseMock.setQueryResult("applications.select.single", {
      data: {
        id: "app-1",
        user_id: "test-user-id",
        status: "applied",
        customized_cv_id: null,
        jobs_cache: {
          title: "Software Engineer",
          company: "Acme",
          location: "London",
          description: "A job description",
          salary_min: 50000,
          salary_max: 70000,
        },
      },
    })
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: {} },
    })

    anthropicStreamMock = vi.fn().mockReturnValue((async function* () {
      yield {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "ok" },
      }
    })())
    vi.mocked(Anthropic).mockImplementation(function MockAnthropic() {
      return {
        messages: { stream: anthropicStreamMock },
      } as never
    })
  })

  it("returns 401 when not authenticated", async () => {
    supabaseMock.setUser(null)

    const response = await POST(
      createChatRequest({ applicationId: "app-1", messages: [] })
    )
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(chatRateLimit.limit).mockResolvedValue({ success: false } as never)

    const response = await POST(
      createChatRequest({ applicationId: "app-1", messages: [] })
    )
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(body).toEqual({
      error:
        "Too many requests. Please wait a moment before sending another message.",
    })
  })

  it("returns 400 when applicationId is missing", async () => {
    const response = await POST(createChatRequest({ messages: [] }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Invalid request" })
  })

  it("returns 400 when messages is not an array", async () => {
    const response = await POST(
      createChatRequest({ applicationId: "app-1", messages: "bad" })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Invalid request" })
  })

  it("returns 404 when application is not found", async () => {
    supabaseMock.setQueryResult("applications.select.single", { data: null })

    const response = await POST(
      createChatRequest({ applicationId: "app-1", messages: [] })
    )
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: "Not found" })
  })

  it("returns 422 when AI config resolution fails", async () => {
    vi.mocked(resolveAiConfig).mockImplementation(() => {
      throw new Error("No API key configured.")
    })

    const response = await POST(
      createChatRequest({
        applicationId: "app-1",
        messages: [{ role: "user", content: "hello" }],
      })
    )
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({ error: "No API key configured." })
  })

  it("caps messages to the last 20", async () => {
    const messages = Array.from({ length: 25 }, (_, index) => ({
      role: "user" as const,
      content: `msg-${index}`,
    }))

    const response = await POST(createChatRequest({ applicationId: "app-1", messages }))

    expect(response.status).toBe(200)
    const streamArgs = anthropicStreamMock.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>
    }
    expect(streamArgs.messages).toHaveLength(20)
    expect(streamArgs.messages[0]).toEqual({ role: "user", content: "msg-5" })
    expect(streamArgs.messages[19]).toEqual({ role: "user", content: "msg-24" })
  })

  it("filters invalid messages", async () => {
    const response = await POST(
      createChatRequest({
        applicationId: "app-1",
        messages: [
          { role: "user", content: "valid-1" },
          { role: "system", content: "invalid-role" },
          { role: "assistant", content: "valid-2" },
          { role: "user" },
          { role: "assistant", content: 123 },
          "not-an-object",
        ],
      })
    )

    expect(response.status).toBe(200)
    const streamArgs = anthropicStreamMock.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>
    }
    expect(streamArgs.messages).toEqual([
      { role: "user", content: "valid-1" },
      { role: "assistant", content: "valid-2" },
    ])
  })

  it("truncates message content to 10000 chars", async () => {
    const longText = "x".repeat(12_000)
    const response = await POST(
      createChatRequest({
        applicationId: "app-1",
        messages: [{ role: "user", content: longText }],
      })
    )

    expect(response.status).toBe(200)
    const streamArgs = anthropicStreamMock.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>
    }
    expect(streamArgs.messages[0].content).toHaveLength(10_000)
    expect(streamArgs.messages[0].content).toBe(longText.slice(0, 10_000))
  })

  it("returns 500 when AI provider throws", async () => {
    vi.mocked(Anthropic).mockImplementation(function ThrowingAnthropic() {
      throw new Error("API error")
    })

    const response = await POST(
      createChatRequest({
        applicationId: "app-1",
        messages: [{ role: "user", content: "hello" }],
      })
    )
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: "AI request failed" })
  })
})
