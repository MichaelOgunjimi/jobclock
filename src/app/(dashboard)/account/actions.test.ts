import { beforeEach, describe, expect, it, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { saveAccountInfo } from "./actions"

describe("saveAccountInfo", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
  })

  it("converts empty payload fields to null", async () => {
    const result = await saveAccountInfo({
      fullName: "",
      phone: "",
      linkedinUrl: "",
      githubUrl: "",
      portfolioUrl: "",
      avatarUrl: "",
    })

    expect(result).toEqual({ success: true })
    const updateCall = supabaseMock
      .getQueryCalls()
      .find((call) => call.table === "profiles" && call.operation === "update")
    expect(updateCall?.payload).toEqual({
      full_name: null,
      phone: null,
      linkedin_url: null,
      github_url: null,
      portfolio_url: null,
      avatar_url: null,
    })
    expect(revalidatePath).toHaveBeenCalledWith("/account")
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout")
  })

  it("handles config, auth, and update error paths", async () => {
    const payload = {
      fullName: "Name",
      phone: "",
      linkedinUrl: "",
      githubUrl: "",
      portfolioUrl: "",
      avatarUrl: "",
    }

    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    expect(await saveAccountInfo(payload)).toEqual({ error: "Supabase not configured" })

    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    supabaseMock.setUser(null)
    expect(await saveAccountInfo(payload)).toEqual({ error: "Unauthorized" })

    supabaseMock.setUser({ id: "test-user-id", email: "test@example.com" })
    supabaseMock.setQueryResult("profiles.update", { error: { message: "failed" } })
    expect(await saveAccountInfo(payload)).toEqual({ error: "failed" })
  })
})
