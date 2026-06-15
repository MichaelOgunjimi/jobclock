import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockSupabaseClient } from "@/test/supabase-mock"

const { db } = vi.hoisted(() => ({
  db: {
    execute: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}))

vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { extractProfileFactDrafts } from "@/lib/interview/profile-facts"
import {
  confirmDiscoveredStory,
  confirmProfileFacts,
  confirmStory,
  createQuestion,
  createStory,
  deleteProfileFact,
  saveAnswer,
  updateStory,
  updateProfileFact,
} from "./actions"

function sqlText(query: unknown): string {
  if (!query || typeof query !== "object" || !("queryChunks" in query)) return String(query)

  return (query as { queryChunks: unknown[] }).queryChunks
    .map((chunk) => {
      if (chunk && typeof chunk === "object" && "queryChunks" in chunk) {
        return sqlText(chunk)
      }
      if (typeof chunk === "string" || typeof chunk === "number" || typeof chunk === "boolean") {
        return String(chunk)
      }
      if (chunk && typeof chunk === "object" && "value" in chunk) {
        return (chunk as { value: unknown[] }).value.map((value) => String(value)).join("")
      }
      return ""
    })
    .join("")
}

function sqlValues(query: unknown): unknown[] {
  if (!query || typeof query !== "object" || !("queryChunks" in query)) return []

  return (query as { queryChunks: unknown[] }).queryChunks.filter(
    (chunk) => chunk === null || typeof chunk !== "object" || !("value" in chunk),
  )
}

describe("interview actions", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    db.execute.mockReset()
    db.update.mockReset()
    db.transaction.mockReset()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    db.transaction.mockImplementation(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db))
  })

  it("returns validation errors and unauthenticated guards", async () => {
    expect(await createQuestion({ text: "", category: "custom" as never })).toEqual({
      error: "Question is required",
    })

    supabaseMock.setUser(null)
    expect(
      await createQuestion({
        text: "Tell me about yourself",
        category: "opening" as never,
      }),
    ).toEqual({ error: "Unauthorized" })
    expect(
      await saveAnswer({
        questionId: "question-1",
        applicationId: null,
        content: "Answer",
        evidenceSnapshot: { factIds: [], storyIds: [], generatedAt: "2026-06-15T00:00:00.000Z" },
      }),
    ).toEqual({ error: "Unauthorized" })
    expect(await confirmProfileFacts([{ sourceRef: "cv:1" }])).toEqual({ error: "Unauthorized" })
    expect(await updateProfileFact("fact-1", { category: "experience", label: "L", detail: "D" })).toEqual({ error: "Unauthorized" })
    expect(await deleteProfileFact("fact-1")).toEqual({ error: "Unauthorized" })
    expect(await confirmStory("story-1")).toEqual({ error: "Unauthorized" })
    expect(
      await confirmDiscoveredStory({
        title: "Story",
        situation: "S",
        task: "T",
        action: "A",
        result: "R",
        tags: [],
      }),
    ).toEqual({ error: "Unauthorized" })
  })

  it("materializes built-in questions with canonical text and targetless conflict handling", async () => {
    db.execute
      .mockResolvedValueOnce([{ id: "question-1" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "question-1" }])

    const input = {
      text: "Client copy should be ignored",
      category: "custom" as never,
      sourceType: "built_in" as const,
      sourceRef: "proudest-achievement",
    }

    expect(await createQuestion(input)).toEqual({ id: "question-1" })
    expect(await createQuestion(input)).toEqual({ id: "question-1" })

    const insertCall = db.execute.mock.calls[0][0]
    expect(sqlText(insertCall)).toContain("INSERT INTO interview_questions")
    expect(sqlText(insertCall)).toContain("ON CONFLICT DO NOTHING")
    expect(sqlValues(insertCall)).toEqual(
      expect.arrayContaining([
        "test-user-id",
        null,
        "What achievement are you most proud of?",
        "strengths",
        "built_in",
        "proudest-achievement",
      ]),
    )
  })

  it("rejects application questions from other users", async () => {
    db.execute.mockResolvedValueOnce([])

    expect(
      await createQuestion({
        text: "Client copy",
        category: "custom" as never,
        sourceType: "application_generated",
        sourceRef: "app-2:question-1",
        applicationId: "app-2",
      }),
    ).toEqual({ error: "Application not found" })
  })

  it("rejects application-generated questions that are not bound to the application id", async () => {
    db.execute.mockResolvedValueOnce([
      {
        id: "app-1",
        title: "Engineer",
        company: "ACME",
      },
    ])

    expect(
      await createQuestion({
        text: "Client copy",
        category: "custom" as never,
        sourceType: "application_generated",
        sourceRef: "question-1",
        applicationId: "app-1",
      }),
    ).toEqual({ error: "Source ref must start with app-1:" })
  })

  it("uses the application id in the conflict fallback predicate for generated questions", async () => {
    db.execute
      .mockResolvedValueOnce([
        {
          id: "app-1",
          title: "Engineer",
          company: "ACME",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "question-existing" }])

    expect(
      await createQuestion({
        text: "Client copy",
        category: "custom" as never,
        sourceType: "application_generated",
        sourceRef: "app-1:screening:1",
        applicationId: "app-1",
      }),
    ).toEqual({ id: "question-existing" })

    const fallbackCall = db.execute.mock.calls.findLast(([query]) =>
      sqlText(query).includes("FROM interview_questions"),
    )
    expect(sqlText(fallbackCall?.[0])).toContain("source_type = application_generated")
    expect(sqlText(fallbackCall?.[0])).toContain("application_id = app-1")
  })

  it("rejects answers for questions that do not belong to the authenticated user", async () => {
    db.execute.mockResolvedValueOnce([])

    expect(
      await saveAnswer({
        questionId: "question-foreign",
        applicationId: null,
        content: "Answer",
        evidenceSnapshot: { factIds: [], storyIds: [], generatedAt: "2026-06-15T00:00:00.000Z" },
      }),
    ).toEqual({ error: "Question not found" })
  })

  it("rejects foreign evidence ids and invalid snapshots", async () => {
    db.execute
      .mockResolvedValueOnce([{ id: "question-1" }])
      .mockResolvedValueOnce([
        {
          id: "fact-owned",
          userId: "test-user-id",
          category: "experience",
          label: "Owned fact",
          detail: "Detail",
          sourceType: "manual",
          sourceRef: "manual:1",
          confirmedAt: "2026-06-15T00:00:00.000Z",
          createdAt: "2026-06-15T00:00:00.000Z",
          updatedAt: "2026-06-15T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "story-owned",
          userId: "test-user-id",
          title: "Owned story",
          situation: "S",
          task: "T",
          action: "A",
          result: "R",
          tags: [],
          sourceType: "manual",
          sourceRef: "story:1",
          confirmedAt: "2026-06-15T00:00:00.000Z",
          createdAt: "2026-06-15T00:00:00.000Z",
          updatedAt: "2026-06-15T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([{ id: "question-1" }])

    expect(
      await saveAnswer({
        questionId: "question-1",
        applicationId: null,
        content: "Answer",
        evidenceSnapshot: {
          factIds: ["fact-owned", "fact-foreign"],
          storyIds: ["story-owned"],
          generatedAt: "2026-06-15T00:00:00.000Z",
        },
      }),
    ).toEqual({ error: "Evidence contains missing or foreign ids" })

    expect(
      await saveAnswer({
        questionId: "question-1",
        applicationId: null,
        content: "x".repeat(5001),
        evidenceSnapshot: { factIds: [], storyIds: [], generatedAt: "2026-06-15T00:00:00.000Z" },
      }),
    ).toEqual({ error: "Answer is too long" })

    db.execute.mockResolvedValueOnce([{ id: "question-1" }])
    expect(
      await saveAnswer({
        questionId: "question-1",
        applicationId: null,
        content: "Answer",
        evidenceSnapshot: { factIds: ["fact-owned", "fact-owned"], storyIds: [], generatedAt: "2026-06-15T00:00:00.000Z" },
      }),
    ).toEqual({ error: "Evidence snapshot is invalid" })

    db.execute.mockResolvedValueOnce([{ id: "question-1" }])
    expect(
      await saveAnswer({
        questionId: "question-1",
        applicationId: null,
        content: "Answer",
        evidenceSnapshot: { factIds: [], storyIds: [], generatedAt: "2026-06-15" },
      }),
    ).toEqual({ error: "Evidence snapshot is invalid" })
  })

  it("demotes only the matching answer context and keeps general and tailored saves independent", async () => {
    db.execute
      .mockResolvedValueOnce([{ id: "question-1" }])
      .mockResolvedValueOnce([
        {
          id: "fact-owned",
          userId: "test-user-id",
          category: "experience",
          label: "Owned fact",
          detail: "Detail",
          sourceType: "manual",
          sourceRef: "manual:1",
          confirmedAt: "2026-06-15T00:00:00.000Z",
          createdAt: "2026-06-15T00:00:00.000Z",
          updatedAt: "2026-06-15T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "story-owned",
          userId: "test-user-id",
          title: "Owned story",
          situation: "S",
          task: "T",
          action: "A",
          result: "R",
          tags: [],
          sourceType: "manual",
          sourceRef: "story:1",
          confirmedAt: "2026-06-15T00:00:00.000Z",
          createdAt: "2026-06-15T00:00:00.000Z",
          updatedAt: "2026-06-15T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "answer-general" }])
      .mockResolvedValueOnce([{ id: "question-1" }])
      .mockResolvedValueOnce([{ id: "app-1" }])
      .mockResolvedValueOnce([
        {
          id: "fact-owned",
          userId: "test-user-id",
          category: "experience",
          label: "Owned fact",
          detail: "Detail",
          sourceType: "manual",
          sourceRef: "manual:1",
          confirmedAt: "2026-06-15T00:00:00.000Z",
          createdAt: "2026-06-15T00:00:00.000Z",
          updatedAt: "2026-06-15T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "story-owned",
          userId: "test-user-id",
          title: "Owned story",
          situation: "S",
          task: "T",
          action: "A",
          result: "R",
          tags: [],
          sourceType: "manual",
          sourceRef: "story:1",
          confirmedAt: "2026-06-15T00:00:00.000Z",
          createdAt: "2026-06-15T00:00:00.000Z",
          updatedAt: "2026-06-15T00:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "answer-tailored" }])

    expect(
      await saveAnswer({
        questionId: "question-1",
        applicationId: null,
        content: "General answer",
        evidenceSnapshot: { factIds: ["fact-owned"], storyIds: ["story-owned"], generatedAt: "2026-06-15T00:00:00.000Z" },
      }),
    ).toEqual({ id: "answer-general" })

    expect(
      await saveAnswer({
        questionId: "question-1",
        applicationId: "app-1",
        content: "Tailored answer",
        evidenceSnapshot: { factIds: ["fact-owned"], storyIds: ["story-owned"], generatedAt: "2026-06-15T00:00:00.000Z" },
      }),
    ).toEqual({ id: "answer-tailored" })

    const updateStatements = db.execute.mock.calls
      .map(([query]) => sqlText(query))
      .filter((statement) => statement.includes("UPDATE interview_answers"))

    expect(updateStatements[0]).toContain("application_id IS NULL")
    expect(updateStatements[1]).toContain("application_id = app-1")
  })

  it("confirms only selected current CV facts and is idempotent", async () => {
    const cv = {
      experience: [
        {
          company: "ACME",
          title: "Engineer",
          start_date: "2024",
          end_date: "2025",
          description: "Built a dashboard",
          highlights: ["Led a rewrite"],
        },
      ],
      education: [],
      projects: [],
      skills: [],
      languages: [],
      certifications: [],
      activities: [],
    }
    const draft = extractProfileFactDrafts(cv as never)[0]

    db.execute
      .mockResolvedValueOnce([
        {
          id: "cv-1",
          userId: "test-user-id",
          parsedJson: cv,
        },
      ])
      .mockResolvedValueOnce([{ id: "fact-1" }])
      .mockResolvedValueOnce([
        {
          id: "cv-1",
          userId: "test-user-id",
          parsedJson: cv,
        },
      ])
      .mockResolvedValueOnce([])

    await expect(confirmProfileFacts([{ sourceRef: draft.sourceRef }, { sourceRef: "tampered" }])).resolves.toEqual({
      inserted: 1,
    })
    await expect(confirmProfileFacts([{ sourceRef: draft.sourceRef }])).resolves.toEqual({ inserted: 0 })

    const insertCall = db.execute.mock.calls.find(([query]) => sqlText(query).includes("INSERT INTO interview_profile_facts"))
    expect(sqlText(insertCall?.[0])).toContain("INSERT INTO interview_profile_facts")
    expect(sqlValues(insertCall?.[0])).toEqual(expect.arrayContaining([draft.category, draft.label, draft.detail, draft.sourceRef, "cv"]))
  })

  it("updates and deletes interview profile facts with user ownership", async () => {
    db.execute.mockResolvedValueOnce([{ id: "fact-1" }]).mockResolvedValueOnce([])

    await updateProfileFact("fact-1", { category: "experience", label: "Updated", detail: "Detail" })
    await deleteProfileFact("fact-1")

    const statements = db.execute.mock.calls.map(([query]) => sqlText(query))
    expect(statements[0]).toContain("UPDATE interview_profile_facts")
    expect(statements[0]).toContain("fact-1")
    expect(statements[0]).toContain("test-user-id")
    expect(statements[1]).toContain("DELETE FROM interview_profile_facts")
    expect(statements[1]).toContain("fact-1")
    expect(statements[1]).toContain("test-user-id")
  })

  it("creates manual and discovered stories with confirmation metadata", async () => {
    db.execute.mockResolvedValueOnce([{ id: "story-1" }]).mockResolvedValueOnce([{ id: "story-2" }]).mockResolvedValueOnce([])

    expect(
      await createStory({
        title: "Manual story",
        situation: "S",
        task: "T",
        action: "A",
        result: "R",
        tags: ["leadership"],
      }),
    ).toEqual({ id: "story-1" })

    expect(
      await confirmDiscoveredStory({
        title: "Discovered story",
        situation: "S",
        task: "T",
        action: "A",
        result: "R",
        tags: ["teamwork"],
      }),
    ).toEqual({ id: "story-2" })

    const statements = db.execute.mock.calls.map(([query]) => sqlText(query))
    expect(statements[0]).toContain("INSERT INTO story_bank")
    expect(statements[0]).toContain("manual")
    expect(statements[0]).toContain("confirmed_at")
    expect(statements[1]).toContain("INSERT INTO story_bank")
    expect(statements[1]).toContain("discovery")
    expect(statements[1]).toContain("confirmed_at")
  })

  it("accepts the expanded story body and tag bounds", async () => {
    const longSituation = "s".repeat(3000)
    const tags = Array.from({ length: 13 }, (_, index) => ` tag-${index} `)

    db.execute.mockResolvedValueOnce([{ id: "story-1" }]).mockResolvedValueOnce([{ id: "story-2" }]).mockResolvedValueOnce([])

    await expect(
      createStory({
        title: "Story under the new limit",
        situation: longSituation,
        task: longSituation,
        action: longSituation,
        result: longSituation,
        tags,
      }),
    ).resolves.toEqual({ id: "story-1" })
    await expect(
      confirmDiscoveredStory({
        title: "Story under the new limit",
        situation: longSituation,
        task: longSituation,
        action: longSituation,
        result: longSituation,
        tags,
      }),
    ).resolves.toEqual({ id: "story-2" })
  })

  it("trims and validates story updates before persisting them", async () => {
    const updateChain = {
      set: vi.fn(),
      where: vi.fn().mockResolvedValue([{ id: "story-1" }]),
    }
    updateChain.set.mockReturnValue(updateChain)
    db.update.mockReturnValue(updateChain as never)

    await expect(
      updateStory("story-1", {
        title: "  Updated story  ",
        situation: "  Situation  ",
        task: "  Task  ",
        action: "  Action  ",
        result: "  Result  ",
        tags: [" alpha ", "beta"],
      }),
    ).resolves.toEqual({})

    expect(updateChain.set).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Updated story",
        situation: "Situation",
        task: "Task",
        action: "Action",
        result: "Result",
        tags: ["alpha", "beta"],
      }),
    )
  })

  it("rejects overlong story updates and avoids touching the database", async () => {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: "story-1" }]),
    }
    db.update.mockReturnValue(updateChain as never)

    await expect(
      updateStory("story-1", {
        title: "x".repeat(201),
      }),
    ).resolves.toEqual({ error: "Title is too long" })

    expect(db.update).not.toHaveBeenCalled()
  })

  it("confirms only owned stories", async () => {
    db.execute.mockResolvedValueOnce([{ id: "story-1" }]).mockResolvedValueOnce([])

    await expect(confirmStory("story-1")).resolves.toEqual({})
    expect(await confirmStory("story-foreign")).toEqual({ error: "Story not found" })

    const statements = db.execute.mock.calls.map(([query]) => sqlText(query))
    expect(statements[0]).toContain("UPDATE story_bank")
    expect(statements[0]).toContain("story-1")
    expect(statements[0]).toContain("test-user-id")
  })
})
