import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: { select: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))

import { loadInterviewPrepContext } from "./interview-prep-context"

const JOB = {
  id: "job-1",
  userId: "user-1",
  applicationId: "app-1",
  kind: "interview_prep",
} as never

function selectOnce(rows: unknown[]) {
  db.select.mockReturnValueOnce({
    from: () => ({
      leftJoin: () => ({ where: vi.fn().mockResolvedValue(rows) }),
      where: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(rows),
        }),
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  })
}

function selectProfileOnce(rows: unknown[]) {
  db.select.mockReturnValueOnce({
    from: () => ({ where: vi.fn().mockResolvedValue(rows) }),
  })
}

function selectStoriesOnce(rows: unknown[]) {
  db.select.mockReturnValueOnce({
    from: () => ({
      where: () => ({ orderBy: vi.fn().mockResolvedValue(rows) }),
    }),
  })
}

const APP_ROW = {
  title: "Engineer",
  company: "ACME",
  description: "JD text",
  customDescription: null,
}
const PROFILE_ROW = { preferences: { ai_provider: "openai" } }
const STORIES = [
  { id: "s-1", title: "Leadership", situation: "S", task: "T", action: "A", result: "R", tags: ["leadership"] },
]

describe("loadInterviewPrepContext", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns context with application, profile, and stories", async () => {
    selectOnce([APP_ROW])
    selectProfileOnce([PROFILE_ROW])
    selectStoriesOnce(STORIES)

    const ctx = await loadInterviewPrepContext(JOB)

    expect(ctx.userId).toBe("user-1")
    expect(ctx.applicationId).toBe("app-1")
    expect(ctx.title).toBe("Engineer")
    expect(ctx.company).toBe("ACME")
    expect(ctx.description).toBe("JD text")
    expect(ctx.stories).toHaveLength(1)
    expect(ctx.preferences).toEqual({ ai_provider: "openai" })
  })

  it("prefers customDescription over jobs_cache description", async () => {
    selectOnce([{ ...APP_ROW, customDescription: "override JD" }])
    selectProfileOnce([PROFILE_ROW])
    selectStoriesOnce([])

    const ctx = await loadInterviewPrepContext(JOB)

    expect(ctx.description).toBe("override JD")
  })

  it("throws when application is not found", async () => {
    selectOnce([])
    selectProfileOnce([PROFILE_ROW])
    selectStoriesOnce([])

    await expect(loadInterviewPrepContext(JOB)).rejects.toThrow("Application not found")
  })
})
