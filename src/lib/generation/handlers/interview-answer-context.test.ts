import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({ db: { select: vi.fn() } }))
vi.mock("@/lib/db", () => ({ db }))

import { loadInterviewAnswerContext } from "./interview-answer-context"

const JOB = {
  id: "job-1",
  userId: "user-1",
  applicationId: "app-1",
  kind: "interview_answer",
  params: { questionText: "Tell me about a time you led a team.", storyId: "story-1" },
} as never

function selectOnce(rows: unknown[]) {
  db.select.mockReturnValueOnce({
    from: () => ({
      leftJoin: () => ({ where: vi.fn().mockResolvedValue(rows) }),
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

function selectStoriesOnce(rows: unknown[]) {
  db.select.mockReturnValueOnce({
    from: () => ({ where: vi.fn().mockResolvedValue(rows) }),
  })
}

const APP_ROW = { title: "Engineer", company: "ACME", description: "JD text", customDescription: null }
const PROFILE_ROW = { preferences: { ai_provider: "openai" } }
const STORY_ROW = { id: "story-1", title: "Leadership", situation: "S", task: "T", action: "A", result: "R" }

describe("loadInterviewAnswerContext", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns context with question, story text, and jdContext", async () => {
    selectOnce([APP_ROW])
    selectOnce([PROFILE_ROW])
    selectStoriesOnce([STORY_ROW])

    const ctx = await loadInterviewAnswerContext(JOB)

    expect(ctx.questionText).toBe("Tell me about a time you led a team.")
    expect(ctx.storyText).toContain("Leadership")
    expect(ctx.jdContext).toContain("Engineer")
    expect(ctx.preferences).toEqual({ ai_provider: "openai" })
  })

  it("throws when params are missing", async () => {
    const jobNoParams = { ...JOB, params: null }
    await expect(loadInterviewAnswerContext(jobNoParams as never)).rejects.toThrow("missing params")
  })

  it("throws when application is not found", async () => {
    selectOnce([])
    selectOnce([PROFILE_ROW])
    selectStoriesOnce([STORY_ROW])

    await expect(loadInterviewAnswerContext(JOB)).rejects.toThrow("Application not found")
  })

  it("throws when story is not found", async () => {
    selectOnce([APP_ROW])
    selectOnce([PROFILE_ROW])
    selectStoriesOnce([])

    await expect(loadInterviewAnswerContext(JOB)).rejects.toThrow("Story not found")
  })
})
