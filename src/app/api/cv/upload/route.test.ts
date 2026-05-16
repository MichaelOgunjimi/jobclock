import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))
vi.mock("pdf-parse", () => ({ default: vi.fn() }))
vi.mock("mammoth", () => ({ default: { extractRawText: vi.fn() } }))
vi.mock("@/lib/ai/parse-cv", () => ({ parseCvWithAi: vi.fn() }))
vi.mock("@/lib/ai/cv-review", () => ({ reviewCv: vi.fn() }))
vi.mock("@/lib/rate-limit", () => ({
  cvGenerateRateLimit: { limit: vi.fn().mockResolvedValue({ success: true }) },
}))

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import pdfParse from "pdf-parse"
import mammoth from "mammoth"
import { parseCvWithAi } from "@/lib/ai/parse-cv"
import { reviewCv } from "@/lib/ai/cv-review"
import { POST } from "./route"

const LONG_TEXT =
  "Experienced software engineer with 7+ years building reliable web platforms and APIs for production systems."

const PARSED_CV = {
  name: "Jane Doe",
  summary: "Backend focused engineer",
}

const validPdfFile = new File([Buffer.from("fake pdf content")], "resume.pdf", {
  type: "application/pdf",
})

function createFormDataRequest(fields: Record<string, string | File>): NextRequest {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value)
  }
  return {
    formData: vi.fn(async () => formData),
  } as unknown as NextRequest
}

describe("POST /api/cv/upload", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()

    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    vi.mocked(pdfParse).mockResolvedValue({ text: LONG_TEXT } as never)
    vi.mocked(mammoth.extractRawText).mockResolvedValue({ value: LONG_TEXT } as never)
    vi.mocked(parseCvWithAi).mockResolvedValue(PARSED_CV as never)
    vi.mocked(reviewCv).mockResolvedValue([])
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: { ai_provider: "openai" } },
    })
    supabaseMock.setQueryResult("user_cvs.select", { data: null, count: 1 } as never)
    supabaseMock.setQueryResult("user_cvs.insert.single", {
      data: { id: "cv-123" },
      error: null,
    })
  })

  it("returns 503 when Supabase is not configured", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)

    const response = await POST(createFormDataRequest({ file: validPdfFile }))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({ error: "Supabase is not configured" })
    expect(createClient).not.toHaveBeenCalled()
  })

  it("returns 401 when not authenticated", async () => {
    supabaseMock.setUser(null)

    const response = await POST(createFormDataRequest({ file: validPdfFile }))
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("returns 400 when no file is provided", async () => {
    const response = await POST(createFormDataRequest({ name: "My CV" }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "No file provided" })
  })

  it("returns 400 when file is larger than 10MB", async () => {
    const tooLargeFile = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", {
      type: "application/pdf",
    })

    const response = await POST(createFormDataRequest({ file: tooLargeFile }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "File too large. Maximum size is 10MB." })
  })

  it("returns 400 when file MIME type is invalid", async () => {
    const invalidFile = new File([Buffer.from("content")], "resume.txt", {
      type: "text/plain",
    })

    const response = await POST(createFormDataRequest({ file: invalidFile }))
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "Invalid file type. Please upload a PDF or DOCX file." })
  })

  it("returns 422 when PDF parsing fails", async () => {
    vi.mocked(pdfParse).mockRejectedValueOnce(new Error("parse failed"))

    const response = await POST(createFormDataRequest({ file: validPdfFile }))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({
      error: "Failed to parse PDF. Please ensure it's a valid PDF file.",
    })
  })

  it("returns 422 when extracted text is too short", async () => {
    vi.mocked(pdfParse).mockResolvedValueOnce({ text: "too short" } as never)

    const response = await POST(createFormDataRequest({ file: validPdfFile }))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({
      error: "Could not extract enough text from the file. Please ensure your CV has readable content.",
    })
  })

  it("returns 422 when AI parsing fails", async () => {
    vi.mocked(parseCvWithAi).mockRejectedValueOnce(new Error("ai failed"))

    const response = await POST(createFormDataRequest({ file: validPdfFile }))
    const body = await response.json()

    expect(response.status).toBe(422)
    expect(body).toEqual({
      error: "Failed to extract CV data. Please check your AI provider settings.",
    })
  })

  it("returns 500 when storage upload fails", async () => {
    supabaseMock.setStorageResult("cvs.upload", {
      error: { message: "upload failed" },
    })

    const response = await POST(createFormDataRequest({ file: validPdfFile }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: "Failed to upload file. Please try again." })
  })

  it("returns 500 when DB insert fails and cleans up uploaded file", async () => {
    supabaseMock.setQueryResult("user_cvs.insert.single", {
      data: null,
      error: { message: "insert failed" },
    })

    const response = await POST(createFormDataRequest({ file: validPdfFile }))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: "Failed to save CV record." })

    const removeCall = supabaseMock
      .getStorageCalls()
      .find((call) => call.bucket === "cvs" && call.operation === "remove")

    expect(removeCall).toBeDefined()
    const [paths] = (removeCall?.args ?? []) as [string[]]
    expect(paths[0]).toContain("test-user-id/")
    expect(paths[0]).toContain("-resume.pdf")
  })

  it("returns success with cvId and parsed data", async () => {
    supabaseMock.setQueryResult("user_cvs.select", { data: null, count: 2 } as never)
    supabaseMock.setQueryResult("user_cvs.insert.single", {
      data: { id: "cv-success-id" },
      error: null,
    })

    const response = await POST(
      createFormDataRequest({
        file: validPdfFile,
        name: "Custom CV Name",
      })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.cvId).toBe("cv-success-id")
    expect(body.parsed).toEqual(PARSED_CV)
    expect(body.fileUrl).toBe("/api/cv/cv-success-id/original")
  })

  it("sets first CV as primary", async () => {
    supabaseMock.setQueryResult("user_cvs.select", { data: null, count: 0 } as never)
    const insertedPayloads: Array<Record<string, unknown>> = []
    const fromMock = supabaseMock.client.from as ReturnType<typeof vi.fn>
    const originalFrom = fromMock.getMockImplementation() as ((table: string) => Record<string, unknown>) | undefined
    fromMock.mockImplementation((table: string) => {
      const builder = originalFrom ? (originalFrom(table) as Record<string, unknown>) : {}
      if (table === "user_cvs" && typeof builder.insert === "function") {
        const originalInsert = builder.insert as (payload: unknown) => unknown
        builder.insert = (payload: unknown) => {
          insertedPayloads.push(payload as Record<string, unknown>)
          return originalInsert(payload)
        }
      }
      return builder as never
    })

    const response = await POST(createFormDataRequest({ file: validPdfFile }))

    expect(response.status).toBe(200)
    expect(insertedPayloads[0]).toMatchObject({
      user_id: "test-user-id",
      is_primary: true,
      file_path: null,
    })
  })

  it("persists review_findings in the inserted user_cvs row when review succeeds", async () => {
    const findings = [
      {
        category: "weak_verb",
        severity: "high",
        location: { section: "experience", entryId: "Junior Developer at Acme Corp", bulletIndex: 0 },
        message: "Bullet starts with 'Responsible for'.",
        suggestion: "Lead with a strong action verb.",
      },
    ]
    vi.mocked(reviewCv).mockResolvedValueOnce(findings as never)

    const insertedPayloads: Array<Record<string, unknown>> = []
    const fromMock = supabaseMock.client.from as ReturnType<typeof vi.fn>
    const originalFrom = fromMock.getMockImplementation() as ((table: string) => Record<string, unknown>) | undefined
    fromMock.mockImplementation((table: string) => {
      const builder = originalFrom ? (originalFrom(table) as Record<string, unknown>) : {}
      if (table === "user_cvs" && typeof builder.insert === "function") {
        const originalInsert = builder.insert as (payload: unknown) => unknown
        builder.insert = (payload: unknown) => {
          insertedPayloads.push(payload as Record<string, unknown>)
          return originalInsert(payload)
        }
      }
      return builder as never
    })

    const response = await POST(createFormDataRequest({ file: validPdfFile }))

    expect(response.status).toBe(200)
    expect(insertedPayloads[0]).toMatchObject({ review_findings: findings })
  })

  it("still succeeds when review fails — inserts the CV without findings", async () => {
    vi.mocked(reviewCv).mockRejectedValueOnce(new Error("review boom"))

    const insertedPayloads: Array<Record<string, unknown>> = []
    const fromMock = supabaseMock.client.from as ReturnType<typeof vi.fn>
    const originalFrom = fromMock.getMockImplementation() as ((table: string) => Record<string, unknown>) | undefined
    fromMock.mockImplementation((table: string) => {
      const builder = originalFrom ? (originalFrom(table) as Record<string, unknown>) : {}
      if (table === "user_cvs" && typeof builder.insert === "function") {
        const originalInsert = builder.insert as (payload: unknown) => unknown
        builder.insert = (payload: unknown) => {
          insertedPayloads.push(payload as Record<string, unknown>)
          return originalInsert(payload)
        }
      }
      return builder as never
    })

    const response = await POST(createFormDataRequest({ file: validPdfFile }))

    expect(response.status).toBe(200)
    expect(insertedPayloads[0]?.review_findings ?? null).toBeNull()
  })
})
