import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { GET } from "./route"

function request() {
  return new NextRequest("https://app.example.com/api/cv/cv-1/original")
}

describe("GET /api/cv/[id]/original", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    supabaseMock.setQueryResult("user_cvs.select.single", {
      data: { original_file_path: "test-user-id/cv.pdf" },
    })
    supabaseMock.setStorageResult("cvs.createSignedUrl", {
      data: { signedUrl: "https://storage.example.com/signed-cv-url" },
    })
  })

  it("requires Supabase configuration", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)

    const response = await GET(request(), { params: Promise.resolve({ id: "cv-1" }) })

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "Supabase is not configured" })
  })

  it("requires an authenticated user", async () => {
    supabaseMock.setUser(null)

    const response = await GET(request(), { params: Promise.resolve({ id: "cv-1" }) })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
  })

  it("redirects the CV owner to a short-lived signed URL", async () => {
    const response = await GET(request(), { params: Promise.resolve({ id: "cv-1" }) })

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://storage.example.com/signed-cv-url")
    expect(supabaseMock.getStorageCalls()).toEqual([
      {
        bucket: "cvs",
        operation: "createSignedUrl",
        args: ["test-user-id/cv.pdf", 60],
      },
    ])
  })

  it("returns 404 when the CV is missing", async () => {
    supabaseMock.setQueryResult("user_cvs.select.single", { data: null })

    const response = await GET(request(), { params: Promise.resolve({ id: "cv-1" }) })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "CV not found" })
  })
})
