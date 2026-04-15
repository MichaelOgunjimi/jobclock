import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { GET } from "./route"

describe("GET /api/template/file/[type]", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>
  let downloadMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    downloadMock = vi.fn(async () => ({
      data: new Blob([Buffer.from("template-content")]),
      error: null,
    }))

    const storageFromMock = vi.mocked(supabaseMock.client.storage.from)
    storageFromMock.mockImplementation((_bucket: string) => ({
      download: downloadMock,
    }) as never)

    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
  })

  it("returns 401 when not authenticated", async () => {
    supabaseMock.setUser(null)
    const request = new NextRequest("http://localhost/api/template/file/cv")

    const response = await GET(request, { params: Promise.resolve({ type: "cv" }) })

    expect(response.status).toBe(401)
    expect(await response.text()).toBe("Unauthorized")
  })

  it("returns 400 when type is invalid", async () => {
    const request = new NextRequest("http://localhost/api/template/file/invalid")

    const response = await GET(request, { params: Promise.resolve({ type: "invalid" }) })

    expect(response.status).toBe(400)
    expect(await response.text()).toBe("Invalid type")
  })

  it("returns 404 when profile has no template path", async () => {
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { cv_template_path: null },
    })
    const request = new NextRequest("http://localhost/api/template/file/cv")

    const response = await GET(request, { params: Promise.resolve({ type: "cv" }) })

    expect(response.status).toBe(404)
    expect(await response.text()).toBe("Not found")
  })

  it("returns 500 when storage download fails", async () => {
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { cv_template_path: "test-user-id/cv-template.docx" },
    })
    downloadMock.mockResolvedValueOnce({
      data: null,
      error: { message: "download failed" },
    })
    const request = new NextRequest("http://localhost/api/template/file/cv")

    const response = await GET(request, { params: Promise.resolve({ type: "cv" }) })

    expect(response.status).toBe(500)
    expect(await response.text()).toBe("Failed to fetch template")
  })

  it("returns file with correct content-type for cv type", async () => {
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { cv_template_path: "test-user-id/cv-template.docx" },
    })
    const request = new NextRequest("http://localhost/api/template/file/cv")

    const response = await GET(request, { params: Promise.resolve({ type: "cv" }) })

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    expect(await response.text()).toBe("template-content")
    expect(downloadMock).toHaveBeenCalledWith("test-user-id/cv-template.docx")
  })

  it("returns file with correct content-type for cover_letter type", async () => {
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { cover_letter_template_path: "test-user-id/cover-letter-template.docx" },
    })
    const request = new NextRequest("http://localhost/api/template/file/cover_letter")

    const response = await GET(request, { params: Promise.resolve({ type: "cover_letter" }) })

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    expect(await response.text()).toBe("template-content")
    expect(downloadMock).toHaveBeenCalledWith("test-user-id/cover-letter-template.docx")
  })
})
