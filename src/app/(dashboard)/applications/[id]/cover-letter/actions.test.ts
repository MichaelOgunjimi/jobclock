import { beforeEach, describe, expect, it, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import {
  saveCoverLetterContent,
  saveCoverLetterTemplatePreference,
} from "./actions"

describe("application cover-letter actions", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
  })

  it("saveCoverLetterContent handles db error and success", async () => {
    supabaseMock.setQueryResult("cover_letters.update", {
      error: { message: "failed" },
    })
    expect(
      await saveCoverLetterContent({
        applicationId: "app-1",
        coverLetterId: "cl-1",
        content: "Hello",
      })
    ).toEqual({ error: "Failed to save cover letter" })

    supabaseMock.setQueryResult("cover_letters.update", { error: null })
    expect(
      await saveCoverLetterContent({
        applicationId: "app-1",
        coverLetterId: "cl-1",
        content: "Hello",
      })
    ).toEqual({ success: true })
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1")
    expect(revalidatePath).toHaveBeenCalledWith("/applications/app-1/cover-letter")
  })

  it("saveCoverLetterTemplatePreference merges preference value", async () => {
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: { existing: true } },
    })

    await saveCoverLetterTemplatePreference("modern")

    const updateCall = supabaseMock
      .getQueryCalls()
      .find((call) => call.table === "profiles" && call.operation === "update")
    expect(updateCall?.payload).toEqual({
      preferences: {
        existing: true,
        preferred_cover_letter_template: "modern",
      },
    })
  })

  it("returns guard errors when not configured or unauthorized", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    expect(
      await saveCoverLetterContent({
        applicationId: "app-1",
        coverLetterId: "cl-1",
        content: "Hello",
      })
    ).toEqual({ error: "Supabase not configured" })

    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    supabaseMock.setUser(null)
    expect(
      await saveCoverLetterContent({
        applicationId: "app-1",
        coverLetterId: "cl-1",
        content: "Hello",
      })
    ).toEqual({ error: "Unauthorized" })
  })
})
