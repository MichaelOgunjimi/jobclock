import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("pdf-parse", () => ({ default: vi.fn() }))
vi.mock("mammoth", () => ({ default: { extractRawText: vi.fn() } }))

import { createClient } from "@/lib/supabase/server"
import pdfParse from "pdf-parse"
import mammoth from "mammoth"
import { NextRequest } from "next/server"
import { POST } from "./route"

function createParseRequest(formData: FormData): NextRequest {
  const request = new NextRequest("http://localhost/api/cover-letter/parse", {
    method: "POST",
    body: formData,
  })
  vi.spyOn(request, "formData").mockResolvedValue(formData)
  return request
}

describe("POST /api/cover-letter/parse", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
  })

  it("returns 401 when not authenticated", async () => {
    supabaseMock.setUser(null)
    const formData = new FormData()
    const request = createParseRequest(formData)

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("returns 400 when no file provided", async () => {
    const formData = new FormData()
    const request = createParseRequest(formData)

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "No file provided" })
  })

  it("returns 400 for unsupported file type (.txt)", async () => {
    const formData = new FormData()
    formData.append("file", new File([Buffer.from("hello")], "cover-letter.txt", { type: "text/plain" }))
    const request = createParseRequest(formData)

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Unsupported file type. Use PDF or DOCX." })
  })

  it("parses PDF file successfully", async () => {
    vi.mocked(pdfParse).mockResolvedValue({ text: "  Parsed PDF text  " } as never)
    const formData = new FormData()
    formData.append("file", new File([Buffer.from("pdf-content")], "cover-letter.pdf", { type: "application/pdf" }))
    const request = createParseRequest(formData)

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ content: "Parsed PDF text" })
    expect(pdfParse).toHaveBeenCalledOnce()
    expect(mammoth.extractRawText).not.toHaveBeenCalled()
  })

  it("parses DOCX file successfully", async () => {
    vi.mocked(mammoth.extractRawText).mockResolvedValue({ value: "  Parsed DOCX text  " } as never)
    const formData = new FormData()
    formData.append(
      "file",
      new File([Buffer.from("docx-content")], "cover-letter.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
    )
    const request = createParseRequest(formData)

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ content: "Parsed DOCX text" })
    expect(mammoth.extractRawText).toHaveBeenCalledOnce()
    expect(pdfParse).not.toHaveBeenCalled()
  })

  it("returns 500 when parsing throws", async () => {
    vi.mocked(pdfParse).mockRejectedValue(new Error("parse failed"))
    const formData = new FormData()
    formData.append("file", new File([Buffer.from("pdf-content")], "cover-letter.pdf", { type: "application/pdf" }))
    const request = createParseRequest(formData)

    const response = await POST(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: "Failed to parse file" })
  })
})
