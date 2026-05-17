import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("./interview-answer-context", () => ({ loadInterviewAnswerContext: vi.fn() }))
vi.mock("@/lib/ai", () => ({ resolveAiConfig: vi.fn(), generateText: vi.fn() }))
vi.mock("@/lib/prompts/interview", () => ({
  interviewAnswerSystemPrompt: vi.fn(() => "sys"),
  interviewAnswerPrompt: vi.fn(() => "usr"),
}))

import { loadInterviewAnswerContext } from "./interview-answer-context"
import { resolveAiConfig, generateText } from "@/lib/ai"
import { interviewAnswerHandler } from "./interview-answer"

const JOB = {
  id: "job-1",
  userId: "user-1",
  applicationId: "app-1",
  kind: "interview_answer",
  params: { questionText: "Tell me about leadership.", storyId: "s-1" },
} as never

const CTX = {
  userId: "user-1",
  applicationId: "app-1",
  questionText: "Tell me about leadership.",
  storyText: "Title: Leadership\nSituation: ...",
  jdContext: "Role: Engineer at ACME.",
  preferences: { ai_provider: "openai" },
}

describe("interviewAnswerHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadInterviewAnswerContext).mockResolvedValue(CTX as never)
    vi.mocked(resolveAiConfig).mockReturnValue({ settings: { provider: "openai", model: "gpt-4.1" }, apiKey: "k" } as never)
    vi.mocked(generateText).mockResolvedValue("  STAR answer text  ")
  })

  it("generates answer, creates new prep row when none exists, returns id", async () => {
    db.select.mockReturnValue({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([]) }) }) })
    const returning = vi.fn().mockResolvedValue([{ id: "prep-new", suggestedAnswers: null }])
    db.insert.mockReturnValue({ values: () => ({ returning }) })

    const resultRef = await interviewAnswerHandler(JOB)

    expect(generateText).toHaveBeenCalledOnce()
    expect(db.insert).toHaveBeenCalled()
    expect(resultRef).toBe("prep-new")
  })

  it("updates existing prep row with the answer, returns existing id", async () => {
    db.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([{ id: "prep-exist", suggestedAnswers: { raw: "old" } }]),
        }),
      }),
    })
    db.update.mockReturnValue({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) })

    const resultRef = await interviewAnswerHandler(JOB)

    expect(db.update).toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
    expect(resultRef).toBe("prep-exist")
  })

  it("throws on LLM failure", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("AI timeout"))
    db.select.mockReturnValue({ from: () => ({ where: () => ({ limit: vi.fn().mockResolvedValue([]) }) }) })

    await expect(interviewAnswerHandler(JOB)).rejects.toThrow("AI timeout")
  })
})
