import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { NextRequest } from "next/server"
import { POST } from "./route"

function createUploadRequest(formData: FormData): NextRequest {
  const request = new NextRequest("http://localhost/api/template/upload", {
    method: "POST",
    body: formData,
  })
  vi.spyOn(request, "formData").mockResolvedValue(formData)
  return request
}

describe("POST /api/template/upload", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
  })

  it("returns 401 when not authenticated", async () => {
    supabaseMock.setUser(null)
    const formData = new FormData()
    const request = createUploadRequest(formData)

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("returns 400 when no file provided", async () => {
    const formData = new FormData()
    formData.append("type", "cv")
    const request = createUploadRequest(formData)

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "No file provided" })
  })

  it("returns 400 when type is invalid", async () => {
    const formData = new FormData()
    formData.append(
      "file",
      new File([Buffer.from("docx")], "template.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    )
    formData.append("type", "invalid")
    const request = createUploadRequest(formData)

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Invalid type" })
  })

  it("returns 400 when file is too large", async () => {
    const formData = new FormData()
    formData.append(
      "file",
      new File([new Uint8Array(10 * 1024 * 1024 + 1)], "template.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    )
    formData.append("type", "cv")
    const request = createUploadRequest(formData)

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "File too large. Maximum size is 10MB." })
  })

  it("returns 400 when MIME type is not DOCX", async () => {
    const formData = new FormData()
    formData.append("file", new File([Buffer.from("text")], "template.txt", { type: "text/plain" }))
    formData.append("type", "cover_letter")
    const request = createUploadRequest(formData)

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Please upload a DOCX file" })
  })

  it("returns 500 when storage upload fails", async () => {
    supabaseMock.setStorageResult("templates.upload", {
      error: { message: "upload failed" },
    })
    const formData = new FormData()
    formData.append(
      "file",
      new File([Buffer.from("docx")], "template.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    )
    formData.append("type", "cv")
    const request = createUploadRequest(formData)

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: "upload failed" })
  })

  it("successful upload returns path", async () => {
    supabaseMock.setStorageResult("templates.upload", { data: { path: "ok" }, error: null })
    const formData = new FormData()
    formData.append(
      "file",
      new File([Buffer.from("docx")], "template.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    )
    formData.append("type", "cover_letter")
    const request = createUploadRequest(formData)

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ path: "test-user-id/cover_letter-template.docx" })
  })
})
