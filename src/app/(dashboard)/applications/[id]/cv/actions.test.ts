import { beforeEach, describe, expect, it, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { saveCustomizedCvData, saveTemplatePreference } from "./actions"

describe("application cv actions", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
  })

  it("saveTemplatePreference merges preference value", async () => {
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: { existing: true } },
    })

    await saveTemplatePreference("classic")

    const updateCall = supabaseMock
      .getQueryCalls()
      .find((call) => call.table === "profiles" && call.operation === "update")
    expect(updateCall?.payload).toEqual({
      preferences: { existing: true, preferred_cv_template: "classic" },
    })
  })

  it("saveCustomizedCvData handles error and success paths", async () => {
    supabaseMock.setQueryResult("customized_cvs.update", {
      error: { message: "failed" },
    })
    expect(
      await saveCustomizedCvData({
        applicationId: "app-1",
        customizedCvId: "ccv-1",
        data: {} as never,
      })
    ).toEqual({ error: "Failed to save tailored CV" })

    supabaseMock.setQueryResult("customized_cvs.update", { error: null })
    expect(
      await saveCustomizedCvData({
        applicationId: "app-1",
        customizedCvId: "ccv-1",
        data: {} as never,
      })
    ).toEqual({ success: true })
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1")
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1/cv")
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1/cv/print")
  })

  it("returns guard errors when not configured or unauthorized", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    expect(
      await saveCustomizedCvData({
        applicationId: "app-1",
        customizedCvId: "ccv-1",
        data: {} as never,
      })
    ).toEqual({ error: "Supabase not configured" })

    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    supabaseMock.setUser(null)
    expect(
      await saveCustomizedCvData({
        applicationId: "app-1",
        customizedCvId: "ccv-1",
        data: {} as never,
      })
    ).toEqual({ error: "Unauthorized" })
  })
})
