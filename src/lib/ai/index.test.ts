import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn((value: string) => `decrypted:${value}`),
}))

import { decrypt } from "@/lib/crypto"
import {
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
      model: "gpt-4.1",
    })

    expect(
      resolveAiSettings({
        ai_provider: "anthropic",
        ai_model: "claude-opus-4-6",
      })
    ).toEqual({
      provider: "anthropic",
      model: "claude-opus-4-6",
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
    expect(resolveApiKey("anthropic", null)).toBe("env-anthropic")

    delete process.env.ANTHROPIC_API_KEY
    expect(() => resolveApiKey("anthropic", null)).toThrow(
      "No API key configured for anthropic. Add one in Settings → AI Configuration."
    )
  })

  it("resolveAiConfig returns settings and resolved key", () => {
    process.env.OPENAI_API_KEY = "env-key"
    expect(
      resolveAiConfig({
        ai_provider: "openai",
        ai_model: "gpt-4o",
      })
    ).toEqual({
      settings: { provider: "openai", model: "gpt-4o" },
      apiKey: "env-key",
    })
  })
})
