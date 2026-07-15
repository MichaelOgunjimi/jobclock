import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

const redirectMock = vi.hoisted(() => vi.fn((href: string) => {
  throw new Error(`REDIRECT:${href}`)
}))

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}))

import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import InterviewPrepRedirectPage from "./page"

describe("InterviewPrepRedirectPage", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
  })

  it("redirects owned application interview links to the central interview workspace", async () => {
    supabaseMock.setQueryResult("applications.select.single", {
      data: { id: "app-123" },
    })

    await expect(
      InterviewPrepRedirectPage({ params: Promise.resolve({ id: "app-123" }) }),
    ).rejects.toThrow("REDIRECT:/interview?applicationId=app-123")
  })

  it("redirects missing or foreign applications back to the pipeline", async () => {
    supabaseMock.setQueryResult("applications.select.single", {
      data: null,
    })

    await expect(
      InterviewPrepRedirectPage({ params: Promise.resolve({ id: "app-123" }) }),
    ).rejects.toThrow("REDIRECT:/applications")
  })
})
