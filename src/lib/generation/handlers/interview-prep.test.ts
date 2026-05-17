import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("./interview-prep-context", () => ({ loadInterviewPrepContext: vi.fn() }))
vi.mock("@/lib/ai", () => ({ resolveAiConfig: vi.fn(), generateText: vi.fn() }))
vi.mock("@/lib/ai/perplexity", () => ({ callPerplexity: vi.fn() }))
vi.mock("@/lib/crypto", () => ({ decrypt: vi.fn((v: string) => v + "-decrypted") }))
vi.mock("@/lib/cv/normalize", () => ({ normalizeAiMarkdown: (s: string) => s.trim() }))
vi.mock("@/lib/prompts/interview", () => ({
  interviewSystemPrompt: vi.fn(() => "sys"),
  interviewUserPrompt: vi.fn(() => "usr"),
}))

import { loadInterviewPrepContext } from "./interview-prep-context"
import { resolveAiConfig, generateText } from "@/lib/ai"
import { callPerplexity } from "@/lib/ai/perplexity"
import { interviewPrepHandler } from "./interview-prep"

const JOB = { id: "job-1", userId: "user-1", applicationId: "app-1", kind: "interview_prep" } as never

const CTX = {
  userId: "user-1",
  applicationId: "app-1",
  title: "Engineer",
  company: "ACME",
  description: "JD text",
  stories: [{ id: "s-1", title: "Leadership", situation: "S", task: "T", action: "A", result: "R", tags: [] }],
  preferences: { ai_provider: "openai" },
}

const GENERATED = "## 2. Likely Questions\n**Q1.** Tell me about a time you led a team."

describe("interviewPrepHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadInterviewPrepContext).mockResolvedValue(CTX as never)
    vi.mocked(resolveAiConfig).mockReturnValue({ settings: { provider: "openai", model: "gpt-4.1" }, apiKey: "k" } as never)
    vi.mocked(generateText).mockResolvedValue(GENERATED)
  })

  it("generates content, inserts new interview_prep row, returns id", async () => {
    db.select.mockReturnValue({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([]) }) }) })
    const returning = vi.fn().mockResolvedValue([{ id: "prep-1" }])
    db.insert.mockReturnValue({ values: () => ({ returning }) })

    const resultRef = await interviewPrepHandler(JOB)

    expect(generateText).toHaveBeenCalled()
    expect(db.insert).toHaveBeenCalled()
    expect(resultRef).toBe("prep-1")
  })

  it("updates existing interview_prep row and returns its id", async () => {
    db.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([{ id: "prep-existing" }]) }) }),
    })
    db.update.mockReturnValue({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) })

    const resultRef = await interviewPrepHandler(JOB)

    expect(db.update).toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
    expect(resultRef).toBe("prep-existing")
  })

  it("uses Perplexity when perplexity_api_key is set", async () => {
    vi.mocked(loadInterviewPrepContext).mockResolvedValue({
      ...CTX,
      preferences: { ...CTX.preferences, perplexity_api_key: "px-key" },
    } as never)
    vi.mocked(callPerplexity).mockResolvedValue(GENERATED)
    db.select.mockReturnValue({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([]) }) }) })
    db.insert.mockReturnValue({ values: () => ({ returning: vi.fn().mockResolvedValue([{ id: "prep-2" }]) }) })

    await interviewPrepHandler(JOB)

    expect(callPerplexity).toHaveBeenCalled()
    expect(generateText).not.toHaveBeenCalled()
  })

  it("throws on LLM failure", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("LLM timeout"))
    db.select.mockReturnValue({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([]) }) }) })

    await expect(interviewPrepHandler(JOB)).rejects.toThrow("LLM timeout")
  })
})
