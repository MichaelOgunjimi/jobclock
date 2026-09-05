import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/applications/route", () => ({ resolveApplicationRoute: vi.fn() }))

const redirectMock = vi.hoisted(() => vi.fn((href: string) => {
  throw new Error(`REDIRECT:${href}`)
}))
const permanentRedirectMock = vi.hoisted(() => vi.fn((href: string) => {
  throw new Error(`PERMANENT_REDIRECT:${href}`)
}))
const notFoundMock = vi.hoisted(() => vi.fn(() => {
  throw new Error("NOT_FOUND")
}))

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  permanentRedirect: permanentRedirectMock,
  redirect: redirectMock,
}))

import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { resolveApplicationRoute } from "@/lib/applications/route"
import InterviewPrepRedirectPage from "./page"

describe("InterviewPrepRedirectPage", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
  })

  it("redirects canonical application links to the central interview workspace", async () => {
    vi.mocked(resolveApplicationRoute).mockResolvedValue({
      id: "app-123",
      slug: "software-engineer-app123",
    })

    await expect(
      InterviewPrepRedirectPage({
        params: Promise.resolve({ id: "software-engineer-app123" }),
      }),
    ).rejects.toThrow("REDIRECT:/interview?application=software-engineer-app123")
  })

  it("permanently redirects UUID application links to the canonical slug", async () => {
    vi.mocked(resolveApplicationRoute).mockResolvedValue({
      id: "e43f3291-4d21-4aa2-bb6f-d9c3ceb9e589",
      slug: "software-engineer-app123",
    })

    await expect(
      InterviewPrepRedirectPage({
        params: Promise.resolve({ id: "e43f3291-4d21-4aa2-bb6f-d9c3ceb9e589" }),
      }),
    ).rejects.toThrow(
      "PERMANENT_REDIRECT:/applications/software-engineer-app123/interview",
    )
  })

  it("returns not found for missing or foreign applications", async () => {
    vi.mocked(resolveApplicationRoute).mockResolvedValue(null)

    await expect(
      InterviewPrepRedirectPage({ params: Promise.resolve({ id: "missing" }) }),
    ).rejects.toThrow("NOT_FOUND")
  })
})
