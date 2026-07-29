import { beforeEach, describe, expect, it, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { createMockSupabaseClient, mockUser } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/crypto", () => ({
  encrypt: vi.fn((value: string) => `enc:${value}`),
  isEncryptionConfigured: vi.fn(() => true),
}))
vi.mock("@/lib/personal-api-tokens", () => ({
  generatePersonalApiToken: vi.fn(),
  revokePersonalApiTokens: vi.fn(),
}))

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { encrypt, isEncryptionConfigured } from "@/lib/crypto"
import { generatePersonalApiToken, revokePersonalApiTokens } from "@/lib/personal-api-tokens"
import {
  generateExtensionToken,
  deleteTemplate,
  revokeExtensionToken,
  saveAiSettings,
  saveDocumentTemplate,
  saveJobSources,
  saveTemplate,
} from "./actions"

function makeFormData(values: Record<string, string>) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.append(key, value)
  return formData
}

describe("settings actions", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
  })

  it("saveAiSettings validates provider/model and saves encrypted keys", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    expect(
      await saveAiSettings(
        makeFormData({
          provider: "openai",
          model: "gpt-4o-mini",
          anthropic_api_key: "",
          openai_api_key: "",
        })
      )
    ).toEqual({ error: "Supabase is not configured" })

    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    supabaseMock.setUser(null)
    expect(
      await saveAiSettings(
        makeFormData({
          provider: "openai",
          model: "gpt-4o-mini",
          anthropic_api_key: "",
          openai_api_key: "",
        })
      )
    ).toEqual({ error: "Unauthorized" })

    supabaseMock.setUser(mockUser)
    expect(
      await saveAiSettings(
        makeFormData({
          provider: "invalid",
          model: "gpt-4o-mini",
          anthropic_api_key: "",
          openai_api_key: "",
        })
      )
    ).toEqual({ error: "Invalid provider" })

    expect(
      await saveAiSettings(
        makeFormData({
          provider: "openai",
          model: "not-a-model",
          anthropic_api_key: "",
          openai_api_key: "",
        })
      )
    ).toEqual({ error: "Invalid model for provider" })

    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: { existing: true } },
    })
    const result = await saveAiSettings(
      makeFormData({
        provider: "openai",
        model: "gpt-4o-mini",
        anthropic_api_key: "a-key",
        openai_api_key: "o-key",
      })
    )

    expect(result).toEqual({ success: true })
    expect(isEncryptionConfigured).toHaveBeenCalled()
    expect(encrypt).toHaveBeenCalledWith("a-key")
    expect(encrypt).toHaveBeenCalledWith("o-key")
    expect(revalidatePath).toHaveBeenCalledWith("/settings")
  })

  it("saveJobSources merges with existing preferences", async () => {
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: { ai_provider: "openai" } },
    })

    const result = await saveJobSources({
      adzuna: { enabled: true },
      reed: { enabled: false },
    })
    expect(result).toEqual({ success: true })

    const updateCall = supabaseMock
      .getQueryCalls()
      .find((call) => call.table === "profiles" && call.operation === "update")
    expect(updateCall?.payload).toEqual({
      preferences: {
        ai_provider: "openai",
        job_sources: {
          adzuna: { enabled: true },
          reed: { enabled: false },
        },
      },
    })
  })

  it("saveJobSources requires encryption before storing Reed API keys", async () => {
    vi.mocked(isEncryptionConfigured).mockReturnValueOnce(false)

    const result = await saveJobSources({
      reed: { enabled: true, api_key: "reed-key" },
    })

    expect(result).toEqual({
      error: "ENCRYPTION_SECRET must be configured to store API keys securely.",
    })
    expect(encrypt).not.toHaveBeenCalled()
  })

  it("saveTemplate writes the template path", async () => {
    const result = await saveTemplate("cv", "user/template.docx")
    expect(result).toEqual({ success: true })

    const updateCall = supabaseMock
      .getQueryCalls()
      .find((call) => call.table === "profiles" && call.operation === "update")
    expect(updateCall?.payload).toEqual({ cv_template_path: "user/template.docx" })
  })

  it("deleteTemplate removes storage file and clears profile column", async () => {
    const result = await deleteTemplate("cover_letter")
    expect(result).toEqual({ success: true })

    expect(supabaseMock.getStorageCalls()).toEqual([
      {
        bucket: "templates",
        operation: "remove",
        args: [[`${mockUser.id}/cover_letter-template.docx`]],
      },
    ])
    const updateCall = supabaseMock
      .getQueryCalls()
      .find((call) => call.table === "profiles" && call.operation === "update")
    expect(updateCall?.payload).toEqual({ cover_letter_template_path: null })
  })

  it("saveDocumentTemplate updates preferences key", async () => {
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: { existing: "value" } },
    })
    const result = await saveDocumentTemplate("cover_letter", "modern")
    expect(result).toEqual({ success: true })

    const updateCall = supabaseMock
      .getQueryCalls()
      .find((call) => call.table === "profiles" && call.operation === "update")
    expect(updateCall?.payload).toEqual({
      preferences: {
        existing: "value",
        preferred_cover_letter_template: "modern",
      },
    })
  })

  it("generateExtensionToken returns raw token and metadata once", async () => {
    vi.mocked(generatePersonalApiToken).mockResolvedValue({
      token: "ja_ext_test-token",
      metadata: {
        id: "token-1",
        tokenPrefix: "ja_ext_test",
        createdAt: "2026-04-23T10:00:00.000Z",
        expiresAt: "2026-07-22T10:00:00.000Z",
        lastUsedAt: null,
      },
    })

    const result = await generateExtensionToken()

    expect(result).toEqual({
      success: true,
      token: "ja_ext_test-token",
      metadata: {
        id: "token-1",
        tokenPrefix: "ja_ext_test",
        createdAt: "2026-04-23T10:00:00.000Z",
        expiresAt: "2026-07-22T10:00:00.000Z",
        lastUsedAt: null,
      },
    })
    expect(generatePersonalApiToken).toHaveBeenCalledWith(mockUser.id)
    expect(revalidatePath).toHaveBeenCalledWith("/settings", "layout")
  })

  it("revokeExtensionToken revokes active tokens", async () => {
    const result = await revokeExtensionToken()

    expect(result).toEqual({
      success: true,
      metadata: null,
    })
    expect(revokePersonalApiTokens).toHaveBeenCalledWith(mockUser.id)
    expect(revalidatePath).toHaveBeenCalledWith("/settings")
  })
})
