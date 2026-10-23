import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({
  chatRateLimit: { limit: vi.fn() },
}))
const { record } = vi.hoisted(() => ({ record: vi.fn() }))
// runAiAction is covered in lib/ai/action.test.ts; here it resolves config from the mocked resolveAiConfig and runs the operation.
vi.mock("@/lib/ai/action", async () => {
  const ai = await import("@/lib/ai")
  return {
    runAiAction: async (request: { preferences: unknown }, operation: (client: unknown) => unknown) => {
      const { settings, apiKey } = ai.resolveAiConfig(request.preferences as never)
      return operation({ settings, apiKey, record })
    },
  }
})
vi.mock("@/lib/billing/usage", () => ({
  AiAllowanceExhaustedError: class extends Error { code = "ai_allowance_exhausted" },
}))
vi.mock("@/lib/ai", () => ({
  MissingAiApiKeyError: class extends Error { code = "missing_ai_api_key" },
  WEB_SEARCH_COST_MICROUSD: 25_000,
  resolveAiConfig: vi.fn(),
  withPlatformAiKeyAccess: vi.fn((preferences, allowPlatformAiKey) => ({
    ...(preferences ?? {}),
    allow_platform_ai_key: Boolean(allowPlatformAiKey),
  })),
}))
vi.mock("@/lib/ai/prompts", () => ({
  buildChatAssistantSystemPrompt: vi.fn().mockReturnValue("system prompt"),
}))
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"
import { chatRateLimit } from "@/lib/rate-limit"
import { MissingAiApiKeyError, resolveAiConfig } from "@/lib/ai"
import { AiAllowanceExhaustedError } from "@/lib/billing/usage"
import { buildChatAssistantSystemPrompt } from "@/lib/ai/prompts"
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

    anthropicStreamMock = vi.fn().mockReturnValue(Object.assign((async function* () {
      yield {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "ok" },
      }
    })(), {
      controller: { abort: vi.fn() },
      finalMessage: async () => ({
        id: "msg-1",
        usage: { input_tokens: 10, output_tokens: 5, server_tool_use: { web_search_requests: 2 } },
      }),
    }))
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
      throw new (MissingAiApiKeyError as new (message: string) => Error)("No API key configured.")
    })

    const response = await POST(
      createChatRequest({
        applicationId: "app-1",
        messages: [{ role: "user", content: "hello" }],
      })
    )
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({ error: "No API key configured.", code: "missing_ai_api_key" })
  })

  it("returns 402 when the hosted AI allowance is exhausted", async () => {
    vi.mocked(resolveAiConfig).mockImplementation(() => {
      throw new AiAllowanceExhaustedError(new Date())
    })

    const response = await POST(
      createChatRequest({ applicationId: "app-1", messages: [{ role: "user", content: "hello" }] })
    )

    expect(response.status).toBe(402)
    expect(await response.json()).toMatchObject({ code: "ai_allowance_exhausted" })
  })

  it("streams the reply, then reports provider usage including web search cost", async () => {
    const response = await POST(
      createChatRequest({ applicationId: "app-1", messages: [{ role: "user", content: "hello" }] })
    )

    expect(await response.text()).toBe("ok")
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      providerRequestId: "msg-1",
      inputTokens: 10,
      outputTokens: 5,
      toolCostMicrousd: 50_000,
    }))
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

  it("uses application corrections in the chat context", async () => {
    supabaseMock.setQueryResult("applications.select.single", {
      data: {
        id: "app-1",
        user_id: "test-user-id",
        status: "applied",
        custom_title: "Senior Engineer",
        custom_company: "Correct ACME",
        custom_location: "Remote",
        custom_salary_text: "£80k plus bonus",
        custom_description: "Corrected description",
        jobs_cache: {
          title: "Software Engineer",
          company: "Acme",
          location: "London",
          description: "Extracted description",
          salary_min: 50000,
          salary_max: 70000,
        },
      },
    })

    const response = await POST(createChatRequest({ applicationId: "app-1", messages: [] }))

    expect(response.status).toBe(200)
    expect(buildChatAssistantSystemPrompt).toHaveBeenCalledWith(expect.objectContaining({
      title: "Senior Engineer",
      company: "Correct ACME",
      location: "Remote",
      salaryLine: "Salary: £80k plus bonus",
      description: "Corrected description",
    }))
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

  it("returns a readable error, not a blank reply, when the provider fails while streaming", async () => {
    anthropicStreamMock.mockReturnValue(Object.assign((async function* () {
      throw Object.assign(new Error("Your credit balance is too low to access the Anthropic API."), { status: 400 })
    })(), { controller: { abort: vi.fn() }, finalMessage: async () => ({}) }))

    const response = await POST(
      createChatRequest({ applicationId: "app-1", messages: [{ role: "user", content: "hello" }] })
    )

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      error: "The AI provider account has no credit left. Add credit or use a different API key in Settings.",
    })
    expect(record).not.toHaveBeenCalled()
  })

  it("returns an error when the model streams no text", async () => {
    anthropicStreamMock.mockReturnValue(Object.assign((async function* () {
      yield { type: "message_start" }
    })(), {
      controller: { abort: vi.fn() },
      finalMessage: async () => ({ id: "msg-2", usage: { input_tokens: 10, output_tokens: 0 } }),
    }))

    const response = await POST(
      createChatRequest({ applicationId: "app-1", messages: [{ role: "user", content: "hello" }] })
    )

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: "The AI returned an empty response. Please try again." })
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ providerRequestId: "msg-2", inputTokens: 10 }))
  })
})
