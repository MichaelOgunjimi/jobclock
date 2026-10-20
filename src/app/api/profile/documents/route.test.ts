import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockSupabaseClient } from "@/test/supabase-mock"

const { db } = vi.hoisted(() => ({ db: { select: vi.fn(), transaction: vi.fn() } }))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({ cvGenerateRateLimit: { limit: vi.fn() } }))
vi.mock("@/lib/ai/profile-document", () => ({ extractProfileDocument: vi.fn() }))
vi.mock("pdf-parse", () => ({ default: vi.fn() }))
vi.mock("mammoth", () => ({ default: { extractRawText: vi.fn() } }))

import { cvGenerateRateLimit } from "@/lib/rate-limit"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { POST } from "./route"

describe("POST /api/profile/documents", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(cvGenerateRateLimit.limit).mockResolvedValue({ success: true } as never)
  })

  it("requires authentication", async () => {
    supabaseMock.setUser(null)
    const response = await POST(new Request("https://app.example.com/api/profile/documents", { method: "POST" }))
    expect(response.status).toBe(401)
  })

  it("requires a file and supported document type", async () => {
    const response = await POST(new Request("https://app.example.com/api/profile/documents", {
      method: "POST",
      body: new FormData(),
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "A file and valid document type are required." })
  })
})
