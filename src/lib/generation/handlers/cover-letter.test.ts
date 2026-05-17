import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: { insert: vi.fn(), delete: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("./cover-letter-context", () => ({ loadCoverLetterContext: vi.fn() }))
vi.mock("@/lib/ai", () => ({ resolveAiConfig: vi.fn(), generateText: vi.fn() }))
vi.mock("@/lib/ai/prompts", () => ({
  buildCoverLetterSystemPrompt: vi.fn(() => "sys"),
  buildCoverLetterUserPrompt: vi.fn(() => "usr"),
}))
vi.mock("@/lib/cover-letter/normalize", () => ({
  normalizeCoverLetterText: (s: string) => s.trim(),
}))

import { loadCoverLetterContext } from "./cover-letter-context"
import { resolveAiConfig, generateText } from "@/lib/ai"
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

describe("coverLetterHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadCoverLetterContext).mockResolvedValue(CONTEXT as never)
    vi.mocked(resolveAiConfig).mockReturnValue({
      settings: { provider: "openai", model: "gpt-4.1" },
      apiKey: "k",
    } as never)
    vi.mocked(generateText).mockResolvedValue("  Dear Hiring Manager...  ")
    db.delete.mockReturnValue({
      where: () => ({ then: undefined }),
    })
  })

  it("generates a letter, inserts a cover_letters row, and returns its id", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "cl-99" }])
    db.insert.mockReturnValue({ values: () => ({ returning }) })
    db.delete.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })

    const resultRef = await coverLetterHandler(JOB)

    expect(loadCoverLetterContext).toHaveBeenCalledWith(JOB)
    expect(generateText).toHaveBeenCalled()
    expect(db.insert).toHaveBeenCalled()
    expect(resultRef).toBe("cl-99")
  })
})
