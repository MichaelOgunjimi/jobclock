import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("./company-research-context", () => ({ loadCompanyResearchContext: vi.fn() }))
vi.mock("@/lib/ai", () => ({ resolveAiConfig: vi.fn(), generateText: vi.fn(), generateTextWithWebSearch: vi.fn() }))
vi.mock("@/lib/ai/perplexity", () => ({ callPerplexity: vi.fn() }))
vi.mock("@/lib/crypto", () => ({ decrypt: vi.fn((v: string) => v + "-decrypted") }))
vi.mock("@/lib/cv/normalize", () => ({ normalizeAiMarkdown: (s: string) => s.trim() }))
vi.mock("@/lib/prompts/company-research", () => ({
  researchSystemPrompt: vi.fn(() => "sys"),
  researchUserPrompt: vi.fn(() => "usr"),
}))

import { loadCompanyResearchContext } from "./company-research-context"
import { resolveAiConfig, generateTextWithWebSearch } from "@/lib/ai"
import { callPerplexity } from "@/lib/ai/perplexity"
import { companyResearchHandler } from "./company-research"

const JOB = {
  id: "job-1",
  userId: "user-1",
  applicationId: "app-1",
  kind: "company_research",
} as never

const CTX = {
  userId: "user-1",
  applicationId: "app-1",
  company: "ACME",
  title: "Engineer",
  description: "JD text",
  preferences: { ai_provider: "openai" },
}

describe("companyResearchHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadCompanyResearchContext).mockResolvedValue(CTX as never)
    vi.mocked(resolveAiConfig).mockReturnValue({
      settings: { provider: "openai", model: "gpt-4.1" },
      apiKey: "k",
    } as never)
    vi.mocked(generateTextWithWebSearch).mockResolvedValue("  research content  ")
  })

  it("generates content, inserts new interview_prep row when none exists, returns id", async () => {
    db.select.mockReturnValue({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([]) }) }) })
    const returning = vi.fn().mockResolvedValue([{ id: "prep-1" }])
    db.insert.mockReturnValue({ values: () => ({ returning }) })

    const resultRef = await companyResearchHandler(JOB)

    expect(generateTextWithWebSearch).toHaveBeenCalled()
    expect(db.insert).toHaveBeenCalled()
    expect(resultRef).toBe("prep-1")
  })

  it("updates existing interview_prep row and returns its id", async () => {
    db.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ id: "prep-existing" }]) }) }),
    })
    db.update.mockReturnValue({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) })

    const resultRef = await companyResearchHandler(JOB)

    expect(db.update).toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
    expect(resultRef).toBe("prep-existing")
  })

  it("uses Perplexity when perplexity_api_key is set in preferences", async () => {
    vi.mocked(loadCompanyResearchContext).mockResolvedValue({
      ...CTX,
      preferences: { ...CTX.preferences, perplexity_api_key: "px-key" },
    } as never)
    vi.mocked(callPerplexity).mockResolvedValue("perplexity result")
    db.select.mockReturnValue({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([]) }) }) })
    db.insert.mockReturnValue({ values: () => ({ returning: vi.fn().mockResolvedValue([{ id: "prep-2" }]) }) })

    await companyResearchHandler(JOB)

    expect(callPerplexity).toHaveBeenCalled()
    expect(generateTextWithWebSearch).not.toHaveBeenCalled()
  })

  it("throws on LLM failure so the dispatcher can mark the job failed", async () => {
    vi.mocked(generateTextWithWebSearch).mockRejectedValue(new Error("LLM timeout"))
    db.select.mockReturnValue({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([]) }) }) })

    await expect(companyResearchHandler(JOB)).rejects.toThrow("LLM timeout")
  })
})
