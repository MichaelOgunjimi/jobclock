import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockSupabaseClient, mockUser } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ redirect: vi.fn() }))
vi.mock("@/lib/ai", () => ({
  resolveAiConfig: vi.fn(),
  generateText: vi.fn(),
}))
vi.mock("@/lib/ai/prompts", () => ({
  buildCoverLetterSystemPrompt: vi.fn(() => "system prompt"),
  buildCoverLetterUserPrompt: vi.fn(() => "user prompt"),
}))
vi.mock("@/lib/rate-limit", () => ({
  aiGenerateRateLimit: {
    limit: vi.fn(),
  },
}))

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { generateText, resolveAiConfig } from "@/lib/ai"
import { buildCoverLetterUserPrompt } from "@/lib/ai/prompts"
import { aiGenerateRateLimit } from "@/lib/rate-limit"
import {
  deleteApplication,
  generateCoverLetter,
  updateCoverLetter,
  updateCv,
  updateDescription,
  updateNotes,
  updateStatus,
  updateWritingStyle,
} from "./actions"

function makeFormData(values: Record<string, string>) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) {
    formData.append(key, value)
  }
  return formData
}

describe("application actions", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(aiGenerateRateLimit.limit).mockResolvedValue({ success: true } as never)
  })

  it("updateStatus updates and sets applied_at on first applied transition", async () => {
    supabaseMock.setQueryResult("applications.select.single", { data: { applied_at: null } })

    await updateStatus(makeFormData({ applicationId: "app-1", status: "applied" }))

    const updateCall = supabaseMock
      .getQueryCalls()
      .find((call) => call.table === "applications" && call.operation === "update")

    expect(updateCall?.payload).toMatchObject({ status: "applied" })
    expect(updateCall?.payload).toHaveProperty("applied_at")
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1")
    expect(revalidatePath).toHaveBeenCalledWith("/applications")
  })

  it("updateStatus does not reset applied_at if already applied", async () => {
    supabaseMock.setQueryResult("applications.select.single", {
      data: { applied_at: "2026-01-01T00:00:00.000Z" },
    })

    await updateStatus(makeFormData({ applicationId: "app-1", status: "applied" }))

    const updateCall = supabaseMock
      .getQueryCalls()
      .find((call) => call.table === "applications" && call.operation === "update")
    expect(updateCall?.payload).toMatchObject({ status: "applied" })
    expect(updateCall?.payload).not.toHaveProperty("applied_at")
  })

  it("updateStatus ignores invalid status", async () => {
    await updateStatus(makeFormData({ applicationId: "app-1", status: "invalid" }))

    expect(
      supabaseMock
        .getQueryCalls()
        .some((call) => call.table === "applications" && call.operation === "update")
    ).toBe(false)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it("updateNotes updates notes", async () => {
    await updateNotes(makeFormData({ applicationId: "app-1", notes: "new notes" }))

    const call = supabaseMock
      .getQueryCalls()
      .find((query) => query.table === "applications" && query.operation === "update")
    expect(call?.payload).toEqual({ notes: "new notes" })
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1")
  })

  it("updateNotes returns early when applicationId is missing", async () => {
    await updateNotes(makeFormData({ notes: "new notes" }))
    expect(
      supabaseMock
        .getQueryCalls()
        .some((query) => query.table === "applications" && query.operation === "update")
    ).toBe(false)
  })

  it("updateCv converts empty cv id to null", async () => {
    await updateCv(makeFormData({ applicationId: "app-1", cvId: "" }))

    const call = supabaseMock
      .getQueryCalls()
      .find((query) => query.table === "applications" && query.operation === "update")
    expect(call?.payload).toEqual({ selected_cv_id: null })
  })

  it("updateCoverLetter converts empty id to null", async () => {
    await updateCoverLetter(makeFormData({ applicationId: "app-1", coverLetterId: "" }))

    const call = supabaseMock
      .getQueryCalls()
      .find((query) => query.table === "applications" && query.operation === "update")
    expect(call?.payload).toEqual({ cover_letter_id: null })
  })

  it("updateWritingStyle writes nullable structure and tone", async () => {
    await updateWritingStyle(
      makeFormData({ applicationId: "app-1", structureId: "", tone: "" })
    )

    const call = supabaseMock
      .getQueryCalls()
      .find((query) => query.table === "applications" && query.operation === "update")
    expect(call?.payload).toEqual({ structure_id: null, cover_letter_tone: null })
  })

  it("deleteApplication deletes record and redirects", async () => {
    await deleteApplication("app-1")

    const deleteCall = supabaseMock
      .getQueryCalls()
      .find((query) => query.table === "applications" && query.operation === "delete")
    expect(deleteCall).toBeTruthy()
    expect(revalidatePath).toHaveBeenCalledWith("/applications")
    expect(redirect).toHaveBeenCalledWith("/applications")
  })

  it("updateDescription returns validation and db errors, then success", async () => {
    expect(await updateDescription(makeFormData({ description: "desc" }))).toEqual({
      error: "Missing application ID",
    })

    supabaseMock.setQueryResult("applications.update", {
      error: { message: "write failed" },
    })
    expect(
      await updateDescription(
        makeFormData({ applicationId: "app-1", description: "desc" })
      )
    ).toEqual({ error: "write failed" })

    supabaseMock.setQueryResult("applications.update", { error: null })
    expect(
      await updateDescription(
        makeFormData({ applicationId: "app-1", description: "desc" })
      )
    ).toEqual({ success: true })
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1")
  })

  it("generateCoverLetter success flow creates a new letter", async () => {
    supabaseMock.setQueryResult("applications.select.single", {
      data: {
        id: "app-1",
        user_id: mockUser.id,
        selected_cv_id: null,
        structure_id: null,
        cover_letter_tone: null,
        custom_description: "Detailed job description",
        jobs_cache: { title: "Engineer", company: "ACME", description: "fallback" },
      },
    })
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: { ai_provider: "openai", ai_model: "gpt-4o-mini" } },
    })
    supabaseMock.setQueryResult("user_cvs.select.maybeSingle", {
      data: { id: "cv-1" },
    })
    supabaseMock.setQueryResult("user_cvs.select.single", {
      data: { parsed_json: { skills: ["TypeScript"] } },
    })
    supabaseMock.setQueryResult("cover_letter_structures.select.maybeSingle", {
      data: { content: "Template content", default_tone: "professional" },
    })
    vi.mocked(resolveAiConfig).mockReturnValue({
      settings: { provider: "openai", model: "gpt-4o-mini" },
      apiKey: "api-key",
    })
    vi.mocked(generateText).mockResolvedValue("  generated letter  ")

    const result = await generateCoverLetter("app-1")

    expect(result).toEqual({ success: true })
    expect(generateText).toHaveBeenCalled()
    const insertCall = supabaseMock
      .getQueryCalls()
      .find((query) => query.table === "cover_letters" && query.operation === "insert")
    expect(insertCall?.payload).toMatchObject({
      user_id: mockUser.id,
      application_id: "app-1",
      content: "generated letter",
      tone: "professional",
    })
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1")
  })

  it("threads stored company research into the cover letter prompt when present", async () => {
    supabaseMock.setQueryResult("applications.select.single", {
      data: {
        id: "app-1",
        user_id: mockUser.id,
        selected_cv_id: null,
        structure_id: null,
        cover_letter_tone: null,
        custom_description: "Detailed job description",
        jobs_cache: { title: "Engineer", company: "ACME", description: "fallback" },
      },
    })
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: { ai_provider: "openai", ai_model: "gpt-4o-mini" } },
    })
    supabaseMock.setQueryResult("user_cvs.select.maybeSingle", { data: { id: "cv-1" } })
    supabaseMock.setQueryResult("user_cvs.select.single", {
      data: { parsed_json: { skills: ["TypeScript"] } },
    })
    supabaseMock.setQueryResult("cover_letter_structures.select.maybeSingle", {
      data: { content: "Template content", default_tone: "professional" },
    })
    supabaseMock.setQueryResult("interview_prep.select.maybeSingle", {
      data: { research_content: "ACME recently launched a logistics API." },
    })
    vi.mocked(resolveAiConfig).mockReturnValue({
      settings: { provider: "openai", model: "gpt-4o-mini" },
      apiKey: "api-key",
    })
    vi.mocked(generateText).mockResolvedValue("letter")

    await generateCoverLetter("app-1")

    expect(buildCoverLetterUserPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        companyResearch: "ACME recently launched a logistics API.",
      }),
    )
  })

  it("omits company research from the prompt when none is stored", async () => {
    supabaseMock.setQueryResult("applications.select.single", {
      data: {
        id: "app-1",
        user_id: mockUser.id,
        selected_cv_id: null,
        structure_id: null,
        cover_letter_tone: null,
        custom_description: "Detailed job description",
        jobs_cache: { title: "Engineer", company: "ACME", description: "fallback" },
      },
    })
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: { ai_provider: "openai", ai_model: "gpt-4o-mini" } },
    })
    supabaseMock.setQueryResult("user_cvs.select.maybeSingle", { data: { id: "cv-1" } })
    supabaseMock.setQueryResult("user_cvs.select.single", {
      data: { parsed_json: { skills: ["TypeScript"] } },
    })
    supabaseMock.setQueryResult("cover_letter_structures.select.maybeSingle", {
      data: { content: "Template content", default_tone: "professional" },
    })
    supabaseMock.setQueryResult("interview_prep.select.maybeSingle", { data: null })
    vi.mocked(resolveAiConfig).mockReturnValue({
      settings: { provider: "openai", model: "gpt-4o-mini" },
      apiKey: "api-key",
    })
    vi.mocked(generateText).mockResolvedValue("letter")

    await generateCoverLetter("app-1")

    const call = vi.mocked(buildCoverLetterUserPrompt).mock.calls[0]?.[0]
    expect(call?.companyResearch ?? null).toBeNull()
  })

  it("generateCoverLetter returns errors for missing description and AI failures", async () => {
    supabaseMock.setQueryResult("applications.select.single", {
      data: {
        id: "app-1",
        user_id: mockUser.id,
        custom_description: "",
        jobs_cache: { description: "" },
      },
    })
    supabaseMock.setQueryResult("profiles.select.single", { data: { preferences: {} } })

    expect(await generateCoverLetter("app-1")).toEqual({
      error: "No job description found. Add one first.",
    })

    supabaseMock.setQueryResult("applications.select.single", {
      data: {
        id: "app-1",
        user_id: mockUser.id,
        custom_description: "desc",
        selected_cv_id: null,
        structure_id: null,
        cover_letter_tone: null,
        jobs_cache: { title: "Role", company: "Org", description: "desc" },
      },
    })
    supabaseMock.setQueryResult("profiles.select.single", { data: { preferences: {} } })
    supabaseMock.setQueryResult("user_cvs.select.maybeSingle", { data: null })
    supabaseMock.setQueryResult("cover_letter_structures.select.maybeSingle", {
      data: { content: "template", default_tone: "professional" },
    })
    vi.mocked(resolveAiConfig).mockImplementation(() => {
      throw new Error("No API key configured.")
    })
    expect(await generateCoverLetter("app-1")).toEqual({
      error: "No API key configured.",
    })

    vi.mocked(resolveAiConfig).mockReturnValue({
      settings: { provider: "openai", model: "gpt-4o-mini" },
      apiKey: "api-key",
    })
    vi.mocked(generateText).mockRejectedValue(new Error("AI failed"))
    expect(await generateCoverLetter("app-1")).toEqual({ error: "AI failed" })

    vi.mocked(generateText).mockResolvedValue("ok")
    supabaseMock.setQueryResult("cover_letters.insert.single", {
      error: { message: "insert failed" },
    })
    expect(await generateCoverLetter("app-1")).toEqual({ error: "insert failed" })
  })

  it("returns early for config and auth guards", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    await updateCv(makeFormData({ applicationId: "app-1", cvId: "cv-1" }))
    expect(supabaseMock.getQueryCalls()).toHaveLength(0)

    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    supabaseMock.setUser(null)
    expect(await updateDescription(makeFormData({ applicationId: "app-1", description: "d" }))).toEqual({
      error: "Unauthorized",
    })
    expect(await generateCoverLetter("app-1")).toEqual({ error: "Not authenticated." })
  })
})
