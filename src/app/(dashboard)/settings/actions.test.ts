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
vi.mock("@/lib/telegram/pairing", () => ({
  generateTelegramPairingToken: vi.fn(),
  disconnectTelegram: vi.fn(),
}))
vi.mock("@/lib/email/preferences", () => ({ setEmailPreference: vi.fn() }))
vi.mock("@/lib/email/agent-access", () => ({ sendAgentAccessNotice: vi.fn() }))
vi.mock("@/lib/mcp/tokens", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mcp/tokens")>()),
  createApiToken: vi.fn(),
  setApiTokenDailyCap: vi.fn(),
}))
vi.mock("@/lib/oauth/tokens", () => ({ revokeConnectedApp: vi.fn(), setConnectedAppDailyCap: vi.fn() }))

import { sendAgentAccessNotice } from "@/lib/email/agent-access"
import { setEmailPreference } from "@/lib/email/preferences"
import { createApiToken, setApiTokenDailyCap } from "@/lib/mcp/tokens"
import { setConnectedAppDailyCap } from "@/lib/oauth/tokens"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { encrypt, isEncryptionConfigured } from "@/lib/crypto"
import { generatePersonalApiToken, revokePersonalApiTokens } from "@/lib/personal-api-tokens"
import { disconnectTelegram, generateTelegramPairingToken } from "@/lib/telegram/pairing"
import {
  createAgentToken,
  setAgentDailyLimit,
  disconnectTelegramAccount,
  generateTelegramPairing,
  generateExtensionToken,
  deleteTemplate,
  revokeExtensionToken,
  saveAiSettings,
  saveDocumentTemplate,
  saveEmailPreference,
  saveJobSources,
  saveTemplate,
} from "./actions"

function makeFormData(values: Record<string, string>) {
  const formData = new FormData()
  if (!("hosted_provider_preference" in values)) formData.append("hosted_provider_preference", "automatic")
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
          model: "gpt-6-luna",
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
          model: "gpt-6-luna",
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
          model: "gpt-6-luna",
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
        model: "gpt-6-luna",
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

  it("lets an active billing grant select JobClock AI", async () => {
    supabaseMock.setQueryResult("profiles.select.single", { data: { preferences: {}, allow_platform_ai_key: false } })
    supabaseMock.setQueryResult("billing_grants.select.maybeSingle", {
      data: { kind: "lifetime", expires_at: null },
    })

    expect(await saveAiSettings(makeFormData({
      provider: "openai",
      model: "gpt-6-luna",
      billing_source: "jobclock",
    }))).toEqual({ success: true })
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

  it("generates a separate short-lived Telegram pairing token", async () => {
    vi.mocked(generateTelegramPairingToken).mockResolvedValue({
      token: "telegram_pairing_token",
      expiresAt: "2026-08-13T10:15:00.000Z",
    })

    await expect(generateTelegramPairing()).resolves.toEqual({
      success: true,
      token: "telegram_pairing_token",
      expiresAt: "2026-08-13T10:15:00.000Z",
    })
    expect(generateTelegramPairingToken).toHaveBeenCalledWith(mockUser.id)
    expect(generatePersonalApiToken).not.toHaveBeenCalled()
  })

  it("disconnects Telegram without touching extension access", async () => {
    await expect(disconnectTelegramAccount()).resolves.toEqual({
      success: true,
      connection: null,
    })
    expect(disconnectTelegram).toHaveBeenCalledWith(mockUser.id)
    expect(revokePersonalApiTokens).not.toHaveBeenCalled()
  })

  it("saves an email preference for the signed-in user only", async () => {
    vi.mocked(setEmailPreference).mockResolvedValue(true)
    await expect(saveEmailPreference("weekly_digest", true)).resolves.toEqual({})
    expect(setEmailPreference).toHaveBeenCalledWith(mockUser.id, "weekly_digest", true)
    expect(revalidatePath).toHaveBeenCalledWith("/settings")
  })

  it("rejects an unknown email type, a failed save and a signed-out user", async () => {
    vi.mocked(setEmailPreference).mockResolvedValueOnce(false)
    await expect(saveEmailPreference("billing", false)).resolves.toEqual({ error: "Unknown email type" })

    vi.mocked(setEmailPreference).mockRejectedValueOnce(new Error("db down"))
    await expect(saveEmailPreference("weekly_digest", true)).resolves.toEqual({ error: "Failed to save your email settings" })

    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    await expect(saveEmailPreference("weekly_digest", true)).resolves.toEqual({ error: "Supabase not configured" })
  })

  describe("agent access", () => {
    const metadata = { id: "tok-1", label: "Laptop", tokenPrefix: "jc_abcde", scopes: ["applications:read"], expiresAt: "2027-02-18T10:00:00.000Z", dailyCreateCap: 100, dailyDeleteCap: 10, dailyCreditCap: 20, createdAt: "", lastUsedAt: null, revokedAt: null }

    it("creates a token with the chosen access and expiry for the signed-in user, and emails a notice without the token", async () => {
      vi.mocked(createApiToken).mockResolvedValue({ token: "jc_secret-token-value", metadata })
      const result = await createAgentToken("Laptop", "read", "90")
      expect(result).toMatchObject({ success: true, token: "jc_secret-token-value" })
      expect(createApiToken).toHaveBeenCalledWith(mockUser.id, "Laptop", { access: "read", extraScopes: [], expiry: "90" })
      expect(sendAgentAccessNotice).toHaveBeenCalledWith(mockUser.email, { kind: "token", name: "Laptop", scopes: ["applications:read"], expiresAt: metadata.expiresAt, idempotencyKey: "agent-token/tok-1" })
      expect(JSON.stringify(vi.mocked(sendAgentAccessNotice).mock.calls)).not.toContain("jc_secret-token-value")
      expect(revalidatePath).toHaveBeenCalledWith("/settings")
    })

    it("passes the chosen private scopes through and names them in the notice", async () => {
      const withExtras = { ...metadata, scopes: ["applications:read", "profile:read", "interview:read"] }
      vi.mocked(createApiToken).mockResolvedValue({ token: "jc_secret-token-value", metadata: withExtras })
      await createAgentToken("Laptop", "read", "90", ["profile:read", "interview:read"])
      expect(createApiToken).toHaveBeenCalledWith(mockUser.id, "Laptop", { access: "read", extraScopes: ["profile:read", "interview:read"], expiry: "90" })
      expect(sendAgentAccessNotice).toHaveBeenCalledWith(mockUser.email, expect.objectContaining({ scopes: ["applications:read", "profile:read", "interview:read"] }))
    })

    it("passes the two powerful scopes through when ticked and names them in the notice", async () => {
      const power = { ...metadata, scopes: ["applications:read", "applications:delete", "ai:generate"] }
      vi.mocked(createApiToken).mockResolvedValue({ token: "jc_secret-token-value", metadata: power })
      await createAgentToken("Laptop", "read", "90", ["applications:delete", "ai:generate"])
      expect(createApiToken).toHaveBeenCalledWith(mockUser.id, "Laptop", { access: "read", extraScopes: ["applications:delete", "ai:generate"], expiry: "90" })
      expect(sendAgentAccessNotice).toHaveBeenCalledWith(mockUser.email, expect.objectContaining({ scopes: ["applications:read", "applications:delete", "ai:generate"] }))
    })

    it.each([[["admin"]], [["applications:write"]], [["profile:read", "profile:read"]], [["profile:read", 5]], [["profile:read", "interview:read", "profile:write", "applications:delete", "ai:generate", "x"]]])("refuses the private scopes %j without creating anything", async (extras) => {
      await expect(createAgentToken("Laptop", "read", "90", extras as never)).resolves.toEqual({ error: expect.stringContaining("private details") })
      expect(createApiToken).not.toHaveBeenCalled()
      expect(sendAgentAccessNotice).not.toHaveBeenCalled()
    })

    it("rejects an unknown access without creating anything or sending a notice", async () => {
      await expect(createAgentToken("Laptop", "admin", "90")).resolves.toEqual({ error: expect.stringContaining("read only") })
      expect(createApiToken).not.toHaveBeenCalled()
      expect(sendAgentAccessNotice).not.toHaveBeenCalled()
    })

    it("sends no notice when creation is refused (bad expiry)", async () => {
      vi.mocked(createApiToken).mockResolvedValue({ error: "Choose how long the token should last." })
      await expect(createAgentToken("Laptop", "read", "forever")).resolves.toEqual({ error: "Choose how long the token should last." })
      expect(sendAgentAccessNotice).not.toHaveBeenCalled()
    })

    it("sets a daily limit only for the signed-in owner, on tokens and on connected apps", async () => {
      vi.mocked(setApiTokenDailyCap).mockResolvedValue(true)
      vi.mocked(setConnectedAppDailyCap).mockResolvedValue(true)
      await expect(setAgentDailyLimit("token", "tok-1", 25)).resolves.toEqual({ success: true, cap: 25 })
      await expect(setAgentDailyLimit("app", "grant-1", 0)).resolves.toEqual({ success: true, cap: 0 })
      expect(setApiTokenDailyCap).toHaveBeenCalledWith(mockUser.id, "tok-1", 25, "create")
      expect(setConnectedAppDailyCap).toHaveBeenCalledWith(mockUser.id, "grant-1", 0, "create")
    })

    it("sets the deletion and credit limits on the right kind, and only the credit limit may be 'no limit' (null)", async () => {
      vi.mocked(setApiTokenDailyCap).mockResolvedValue(true)
      vi.mocked(setConnectedAppDailyCap).mockResolvedValue(true)
      await expect(setAgentDailyLimit("token", "tok-1", 3, "delete")).resolves.toEqual({ success: true, cap: 3 })
      await expect(setAgentDailyLimit("app", "grant-1", null, "credit")).resolves.toEqual({ success: true, cap: null })
      await expect(setAgentDailyLimit("token", "tok-1", 0, "credit")).resolves.toEqual({ success: true, cap: 0 })
      expect(setApiTokenDailyCap).toHaveBeenCalledWith(mockUser.id, "tok-1", 3, "delete")
      expect(setConnectedAppDailyCap).toHaveBeenCalledWith(mockUser.id, "grant-1", null, "credit")
      vi.mocked(setApiTokenDailyCap).mockClear()
      await expect(setAgentDailyLimit("token", "tok-1", null, "delete")).resolves.toEqual({ error: expect.stringContaining("switches deleting off") })
      await expect(setAgentDailyLimit("token", "tok-1", null)).resolves.toEqual({ error: expect.stringContaining("0 means no daily limit") })
      await expect(setAgentDailyLimit("token", "tok-1", 1001, "delete")).resolves.toEqual({ error: expect.stringContaining("switches deleting off") })
      await expect(setAgentDailyLimit("token", "tok-1", -1, "credit")).resolves.toEqual({ error: expect.stringContaining("switches AI generation off") })
      await expect(setAgentDailyLimit("token", "tok-1", 5, "nonsense" as never)).resolves.toEqual({ error: "Unknown limit." })
      expect(setApiTokenDailyCap).not.toHaveBeenCalled()
    })

    it.each([-1, 1.5, Number.NaN, 1_000_001])("rejects the daily limit %s and says what is allowed", async (value) => {
      await expect(setAgentDailyLimit("token", "tok-1", value)).resolves.toEqual({ error: expect.stringContaining("0 means no daily limit") })
      expect(setApiTokenDailyCap).not.toHaveBeenCalled()
    })

    it("reports a connection that is not theirs", async () => {
      vi.mocked(setApiTokenDailyCap).mockResolvedValue(false)
      await expect(setAgentDailyLimit("token", "someone-elses", 5)).resolves.toEqual({ error: "Connection not found or already removed" })
    })

    it("refuses when signed out", async () => {
      supabaseMock.setUser(null)
      await expect(setAgentDailyLimit("token", "tok-1", 5)).resolves.toEqual({ error: "Unauthorized" })
      await expect(createAgentToken("Laptop", "read", "90")).resolves.toEqual({ error: "Unauthorized" })
    })
  })
})
