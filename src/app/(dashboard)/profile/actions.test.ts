import { beforeEach, describe, expect, it, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { createMockSupabaseClient, mockUser } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import {
  deleteCv,
  deleteWritingStyle,
  renameCv,
  saveCvData,
  saveGenerationAutomation,
  savePreferences,
  saveWritingStyle,
  setPrimaryCV,
} from "./actions"

function makeFormData(values: Record<string, string>) {
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) formData.append(key, value)
  return formData
}

describe("profile actions", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
  })

  it("setPrimaryCV flips primary flags", async () => {
    await setPrimaryCV(makeFormData({ cvId: "cv-1" }))

    const updates = supabaseMock
      .getQueryCalls()
      .filter((call) => call.table === "user_cvs" && call.operation === "update")
    expect(updates).toHaveLength(2)
    expect(revalidatePath).toHaveBeenCalledWith("/profile")
  })

  it("deleteCv removes file, row, and promotes next cv when primary", async () => {
    supabaseMock.setQueryResult("user_cvs.select.single", {
      data: { original_file_path: "user/cv.pdf", is_primary: true },
    })
    supabaseMock.queueQueryResult("user_cvs.select.single", { data: { id: "cv-2" } })

    await deleteCv(makeFormData({ cvId: "cv-1" }))

    expect(supabaseMock.getStorageCalls()).toEqual([
      { bucket: "cvs", operation: "remove", args: [["user/cv.pdf"]] },
    ])
    expect(
      supabaseMock
        .getQueryCalls()
        .some((call) => call.table === "user_cvs" && call.operation === "delete")
    ).toBe(true)
    expect(revalidatePath).toHaveBeenCalledWith("/profile")
  })

  it("deleteCv returns early when not configured or unauthorized", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    await deleteCv(makeFormData({ cvId: "cv-1" }))
    expect(supabaseMock.getQueryCalls()).toHaveLength(0)

    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    supabaseMock.setUser(null)
    await deleteCv(makeFormData({ cvId: "cv-1" }))
    expect(supabaseMock.getQueryCalls()).toHaveLength(0)
  })

  it("saveCvData handles config/auth/error/success", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    expect(await saveCvData("cv-1", {} as never)).toEqual({
      error: "Supabase not configured",
    })

    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    supabaseMock.setUser(null)
    expect(await saveCvData("cv-1", {} as never)).toEqual({ error: "Unauthorized" })

    supabaseMock.setUser(mockUser)
    supabaseMock.setQueryResult("user_cvs.update", { error: { message: "failed" } })
    expect(await saveCvData("cv-1", {} as never)).toEqual({ error: "Failed to save" })

    supabaseMock.setQueryResult("user_cvs.update", { error: null })
    expect(await saveCvData("cv-1", {} as never)).toEqual({ success: true })
  })

  it("renameCv ignores blank names and updates trimmed names", async () => {
    await renameCv(makeFormData({ cvId: "cv-1", name: "   " }))
    expect(
      supabaseMock
        .getQueryCalls()
        .some((call) => call.table === "user_cvs" && call.operation === "update")
    ).toBe(false)

    await renameCv(makeFormData({ cvId: "cv-1", name: "  New Name  " }))
    const updateCall = supabaseMock
      .getQueryCalls()
      .find((call) => call.table === "user_cvs" && call.operation === "update")
    expect(updateCall?.payload).toEqual({ name: "New Name" })
  })

  it("saveWritingStyle validates and supports create/update", async () => {
    expect(
      await saveWritingStyle(makeFormData({ label: "", content: "", default_tone: "professional" }))
    ).toEqual({ error: "Label and content are required" })

    supabaseMock.setQueryResult("cover_letter_structures.select.single", {
      data: { id: "style-1", label: "Custom", content: "Body" },
      error: null,
    })
    const createResult = await saveWritingStyle(
      makeFormData({ label: "Custom", content: "Body", default_tone: "professional" })
    )
    expect(createResult).toMatchObject({ success: true })

    supabaseMock.setQueryResult("cover_letter_structures.select.single", {
      data: { id: "style-1", label: "Updated", content: "Body 2" },
      error: null,
    })
    const updateResult = await saveWritingStyle(
      makeFormData({
        id: "style-1",
        label: "Updated",
        content: "Body 2",
        default_tone: "enthusiastic",
      })
    )
    expect(updateResult).toMatchObject({ success: true })
  })

  it("deleteWritingStyle deletes custom style rows", async () => {
    await deleteWritingStyle(makeFormData({ id: "style-1" }))
    expect(
      supabaseMock
        .getQueryCalls()
        .some((call) => call.table === "cover_letter_structures" && call.operation === "delete")
    ).toBe(true)
    expect(revalidatePath).toHaveBeenCalledWith("/profile")
  })

  it("savePreferences converts empty arrays to null", async () => {
    const result = await savePreferences({
      desiredRoles: ["Engineer"],
      locationsUk: [],
      targetSalaryMin: null,
      rightToWorkUk: true,
      experienceLevel: [],
    })

    expect(result).toEqual({ success: true })
    const updateCall = supabaseMock
      .getQueryCalls()
      .find((call) => call.table === "profiles" && call.operation === "update")
    expect(updateCall?.payload).toEqual({
      desired_roles: ["Engineer"],
      locations_uk: null,
      target_salary_min: null,
      right_to_work_uk: true,
      experience_level: null,
    })
  })

  it("saveGenerationAutomation merges both toggles into existing preferences", async () => {
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: { ai_provider: "openai", preferred_cv_template: "modern" } },
    })

    const result = await saveGenerationAutomation({
      generateCv: true,
      generateCoverLetter: false,
    })

    expect(result).toEqual({ success: true })
    const updateCall = supabaseMock
      .getQueryCalls()
      .find((call) => call.table === "profiles" && call.operation === "update")
    expect(updateCall?.payload).toEqual({
      preferences: {
        ai_provider: "openai",
        preferred_cv_template: "modern",
        auto_generate_cv_on_job_add: true,
        auto_generate_cover_letter_on_job_add: false,
      },
    })
    expect(revalidatePath).toHaveBeenCalledWith("/profile")
  })
})
