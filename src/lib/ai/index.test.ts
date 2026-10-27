import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const openAiCreateMock = vi.hoisted(() => vi.fn())
const anthropicCreateMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn((value: string) => `decrypted:${value}`),
}))
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: openAiCreateMock } }
  },
}))
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: anthropicCreateMock }
  },
}))

import { decrypt } from "@/lib/crypto"
import {
  generateText,
  MissingAiApiKeyError,
  resolveAiConfig,
  resolveApiKey,
  resolveAiSettings,
  type UserPreferences,
} from "./index"

const originalOpenAi = process.env.OPENAI_API_KEY
const originalAnthropic = process.env.ANTHROPIC_API_KEY

describe("ai config helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.OPENAI_API_KEY
    delete process.env.ANTHROPIC_API_KEY
  })

  afterEach(() => {
    if (originalOpenAi === undefined) {
      delete process.env.OPENAI_API_KEY
    } else {
      process.env.OPENAI_API_KEY = originalOpenAi
    }
    if (originalAnthropic === undefined) {
      delete process.env.ANTHROPIC_API_KEY
    } else {
      process.env.ANTHROPIC_API_KEY = originalAnthropic
    }
  })

  it("resolveAiSettings uses defaults and explicit preferences", () => {
    expect(resolveAiSettings(null)).toEqual({
      provider: "openai",
      model: "gpt-6.1-sol",
    })

    expect(
      resolveAiSettings({
        ai_provider: "anthropic",
        ai_model: "claude-opus-5-5",
      })
    ).toEqual({
      provider: "anthropic",
      model: "claude-opus-5-5",
    })
  })

  it("resolveAiSettings replaces retired saved models with the provider default", () => {
    expect(
      resolveAiSettings({
        ai_provider: "openai",
        ai_model: "gpt-4.1",
      })
    ).toEqual({
      provider: "openai",
      model: "gpt-6.1-sol",
    })
  })

  it("resolveApiKey prefers stored encrypted keys over env", () => {
    process.env.OPENAI_API_KEY = "env-openai"
    const prefs: UserPreferences = { openai_api_key: "stored-openai" }

    expect(resolveApiKey("openai", prefs)).toBe("decrypted:stored-openai")
    expect(decrypt).toHaveBeenCalledWith("stored-openai")
  })

  it("resolveApiKey supports non-encrypted stored values", () => {
    vi.mocked(decrypt).mockImplementationOnce((value) => value)
    const prefs: UserPreferences = { anthropic_api_key: "plain-anthropic" }
    expect(resolveApiKey("anthropic", prefs)).toBe("plain-anthropic")
  })

  it("resolveApiKey falls back to env key and throws when missing", () => {
    process.env.ANTHROPIC_API_KEY = "env-anthropic"
    expect(resolveApiKey("anthropic", { allow_platform_ai_key: true })).toBe("env-anthropic")

    delete process.env.ANTHROPIC_API_KEY
    expect(() => resolveApiKey("anthropic", { allow_platform_ai_key: true })).toThrow(
      "No API key configured for anthropic. Add one in Settings → AI Configuration."
    )
    expect(() => resolveApiKey("anthropic", { allow_platform_ai_key: true })).toThrow(
      MissingAiApiKeyError
    )
  })

  it("resolveApiKey does not use env keys for non-allowlisted users", () => {
    process.env.OPENAI_API_KEY = "env-openai"

    expect(() => resolveApiKey("openai", null)).toThrow(
      "No API key configured for openai. Add one in Settings → AI Configuration."
    )
    expect(() => resolveApiKey("openai", {})).toThrow(
      "No API key configured for openai. Add one in Settings → AI Configuration."
    )
  })

  it("resolveAiConfig returns settings and resolved key", () => {
    process.env.OPENAI_API_KEY = "env-key"
    expect(
      resolveAiConfig({
        ai_provider: "openai",
        ai_model: "gpt-6-luna",
        allow_platform_ai_key: true,
      })
    ).toEqual({
      settings: { provider: "openai", model: "gpt-6-luna" },
      apiKey: "env-key",
    })
  })

  it("generateText sends GPT-6 token limits with max_completion_tokens", async () => {
    openAiCreateMock.mockResolvedValue({
      choices: [{ message: { content: "Generated text" } }],
    })

    await generateText(
      { provider: "openai", model: "gpt-6.1-sol" },
      "test-key",
      "system",
      "user",
      1200,
    )

    expect(openAiCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-6.1-sol",
        max_completion_tokens: 1200,
      }),
    )
    expect(openAiCreateMock.mock.calls[0]?.[0]).not.toHaveProperty("max_tokens")
  })

  it("generateText extracts Anthropic text after thinking blocks", async () => {
    anthropicCreateMock.mockResolvedValue({
      content: [
        { type: "thinking", thinking: "Internal reasoning" },
        { type: "text", text: "Generated text" },
      ],
      usage: { input_tokens: 1, output_tokens: 1 },
    })

    await expect(
      generateText(
        { provider: "anthropic", model: "claude-sonnet-5-5" },
        "test-key",
        "system",
        "user",
      ),
    ).resolves.toBe("Generated text")
  })
})
