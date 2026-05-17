import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/generation/enqueue", () => ({ enqueueGeneration: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { enqueueGeneration } from "@/lib/generation/enqueue"
import { mockUser } from "@/test/supabase-mock"
import { POST } from "./route"

function createRequest(): NextRequest {
  return new NextRequest("http://localhost/api/applications/app-1/cv/generate", { method: "POST" })
}

describe("POST /api/applications/[id]/cv/generate", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(enqueueGeneration).mockResolvedValue({ jobId: "job-1", deduped: false })
  })

  it("returns 401 when not authenticated", async () => {
    supabaseMock.setUser(null)

    const res = await POST(createRequest(), { params: Promise.resolve({ id: "app-1" }) })
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("enqueues cv_tailor job and returns 202 with jobId", async () => {
    const res = await POST(createRequest(), { params: Promise.resolve({ id: "app-1" }) })
    const body = await res.json()

    expect(enqueueGeneration).toHaveBeenCalledWith({
      kind: "cv_tailor",
      userId: mockUser.id,
      applicationId: "app-1",
    })
    expect(res.status).toBe(202)
    expect(body).toEqual({ jobId: "job-1", deduped: false })
  })

  it("returns 202 with deduped:true when job already in-flight", async () => {
    vi.mocked(enqueueGeneration).mockResolvedValue({ jobId: "job-existing", deduped: true })

    const res = await POST(createRequest(), { params: Promise.resolve({ id: "app-1" }) })
    const body = await res.json()

    expect(res.status).toBe(202)
    expect(body).toEqual({ jobId: "job-existing", deduped: true })
  })

  it("returns 429 when enqueue returns a rate-limit error", async () => {
    vi.mocked(enqueueGeneration).mockResolvedValue({
      error: "Too many requests. Please wait a moment before trying again.",
    })

    const res = await POST(createRequest(), { params: Promise.resolve({ id: "app-1" }) })
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body).toEqual({
      error: "Too many requests. Please wait a moment before trying again.",
    })
  })
})
