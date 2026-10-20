import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockSupabaseClient } from "@/test/supabase-mock"

const { db } = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))

import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { GET } from "./route"

function selectDocuments(rows: unknown[]) {
  db.select.mockReturnValue({
    from: () => ({ where: vi.fn().mockResolvedValue(rows) }),
  })
}

describe("GET /api/profile/documents/[id]", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    selectDocuments([
      {
        id: "doc-1",
        userId: "test-user-id",
        originalFilePath: "test-user-id/doc-1/transcript.pdf",
      },
    ])
    supabaseMock.setStorageResult("profile-documents.createSignedUrl", {
      data: { signedUrl: "https://storage.example.com/private-document" },
    })
  })

  it("requires authentication", async () => {
    supabaseMock.setUser(null)
    const response = await GET(new Request("https://app.example.com/api/profile/documents/doc-1"), {
      params: Promise.resolve({ id: "doc-1" }),
    })
    expect(response.status).toBe(401)
  })

  it("redirects the owner to a short-lived signed URL", async () => {
    const response = await GET(new Request("https://app.example.com/api/profile/documents/doc-1"), {
      params: Promise.resolve({ id: "doc-1" }),
    })
    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://storage.example.com/private-document")
    expect(supabaseMock.getStorageCalls()).toEqual([
      {
        bucket: "profile-documents",
        operation: "createSignedUrl",
        args: ["test-user-id/doc-1/transcript.pdf", 60],
      },
    ])
  })
})
