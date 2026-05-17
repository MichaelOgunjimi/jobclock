import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: { insert: vi.fn(), delete: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("./cover-letter-context", () => ({ loadCoverLetterContext: vi.fn() }))
vi.mock("./company-research", () => ({ composeResearch: vi.fn() }))
vi.mock("@/lib/ai", () => ({ resolveAiConfig: vi.fn(), generateText: vi.fn() }))
vi.mock("@/lib/ai/prompts", () => ({
  buildCoverLetterSystemPrompt: vi.fn(() => "sys"),
  buildCoverLetterUserPrompt: vi.fn(() => "usr"),
}))
vi.mock("@/lib/cover-letter/normalize", () => ({
  normalizeCoverLetterText: (s: string) => s.trim(),
}))

import { loadCoverLetterContext } from "./cover-letter-context"
import { composeResearch } from "./company-research"
import { resolveAiConfig, generateText } from "@/lib/ai"
import { buildCoverLetterUserPrompt } from "@/lib/ai/prompts"
import { coverLetterHandler } from "./cover-letter"

const JOB = {
  id: "job-1",
  userId: "user-1",
  applicationId: "app-1",
  kind: "cover_letter",
} as never

const CONTEXT = {
  userId: "user-1",
  applicationId: "app-1",
  title: "Engineer",
  company: "ACME",
  description: "JD text",
  cvContext: "candidate background",
  templateSnippet: "structure",
  companyResearch: "ACME ships logistics APIs",
  tone: "professional",
  preferences: { ai_provider: "openai" },
}

function setupDefaults() {
  vi.mocked(loadCoverLetterContext).mockResolvedValue(CONTEXT as never)
  vi.mocked(resolveAiConfig).mockReturnValue({
    settings: { provider: "openai", model: "gpt-4.1" },
    apiKey: "k",
  } as never)
  vi.mocked(generateText).mockResolvedValue("  Dear Hiring Manager...  ")
  db.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
}

describe("coverLetterHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it("generates a letter, inserts a cover_letters row, and returns its id", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "cl-99" }])
    db.insert.mockReturnValue({ values: () => ({ returning }) })

    const resultRef = await coverLetterHandler(JOB)

    expect(loadCoverLetterContext).toHaveBeenCalledWith(JOB)
    expect(generateText).toHaveBeenCalled()
    expect(db.insert).toHaveBeenCalled()
    expect(resultRef).toBe("cl-99")
  })

  it("deletes old letters after inserting the new one (replace-old-letters)", async () => {
    const deletWhere = vi.fn().mockResolvedValue(undefined)
    db.insert.mockReturnValue({ values: () => ({ returning: vi.fn().mockResolvedValue([{ id: "cl-new" }]) }) })
    db.delete.mockReturnValue({ where: deletWhere })

    await coverLetterHandler(JOB)

    expect(db.delete).toHaveBeenCalled()
    expect(deletWhere).toHaveBeenCalled()
  })

  it("runs composeResearch first when no company research exists, then passes it to the prompt", async () => {
    const ctxNoResearch = { ...CONTEXT, companyResearch: undefined }
    vi.mocked(loadCoverLetterContext).mockResolvedValue(ctxNoResearch as never)
    vi.mocked(composeResearch).mockResolvedValue("fresh ACME research")
    db.insert.mockReturnValue({ values: () => ({ returning: vi.fn().mockResolvedValue([{ id: "cl-50" }]) }) })

    await coverLetterHandler(JOB)

    expect(composeResearch).toHaveBeenCalledWith(JOB)
    const promptCall = vi.mocked(buildCoverLetterUserPrompt).mock.calls[0][0]
    expect(promptCall.companyResearch).toBe("fresh ACME research")
  })

  it("skips composeResearch when research already exists", async () => {
    db.insert.mockReturnValue({ values: () => ({ returning: vi.fn().mockResolvedValue([{ id: "cl-51" }]) }) })

    await coverLetterHandler(JOB)

    expect(composeResearch).not.toHaveBeenCalled()
  })

  it("throws on LLM failure so the dispatcher marks the job failed", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("LLM timeout"))
    db.insert.mockReturnValue({ values: () => ({ returning: vi.fn().mockResolvedValue([{ id: "cl-x" }]) }) })

    await expect(coverLetterHandler(JOB)).rejects.toThrow("LLM timeout")
  })

  it("inserts cover letter scoped to the job userId (cross-tenant isolation)", async () => {
    let capturedValues: Record<string, unknown> | undefined
    db.insert.mockReturnValue({
      values: (v: Record<string, unknown>) => {
        capturedValues = v
        return { returning: vi.fn().mockResolvedValue([{ id: "cl-99" }]) }
      },
    })

    await coverLetterHandler(JOB)

    expect(capturedValues?.userId).toBe("user-1")
  })
})
