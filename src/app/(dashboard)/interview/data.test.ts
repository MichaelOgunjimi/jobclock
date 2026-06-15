import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: { execute: vi.fn() },
}))

vi.mock("@/lib/db", () => ({ db }))

import { extractProfileFactDrafts } from "@/lib/interview/profile-facts"
import { COMMON_INTERVIEW_QUESTIONS_BY_KEY } from "@/lib/interview/question-catalog"
import { loadInterviewWorkspace, loadPrimaryInterviewCvDrafts } from "./data"

function sqlText(query: unknown): string {
  if (!query || typeof query !== "object" || !("queryChunks" in query)) return String(query)

  return (query as { queryChunks: unknown[] }).queryChunks
    .map((chunk) => {
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

describe("loadInterviewWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("merges built-ins with persisted questions using canonical keys and stable tie ordering", async () => {
    db.execute
      .mockResolvedValueOnce([
        {
          id: "question-db-proud",
          userId: "user-1",
          applicationId: null,
          text: "Client copy should be ignored",
          category: "custom",
          sourceType: "built_in",
          sourceRef: "proudest-achievement",
          createdAt: "2026-06-15T09:00:00.000Z",
          updatedAt: "2026-06-15T10:00:00.000Z",
        },
        {
          id: "question-db-a",
          userId: "user-1",
          applicationId: "app-1",
          text: "Custom application question A",
          category: "custom",
          sourceType: "application_generated",
          sourceRef: "app-1:screening:1",
          createdAt: "2026-06-15T11:00:00.000Z",
          updatedAt: "2026-06-15T12:00:00.000Z",
        },
        {
          id: "question-db-b",
          userId: "user-1",
          applicationId: "app-1",
          text: "Custom application question B",
          category: "custom",
          sourceType: "application_generated",
          sourceRef: "app-1:screening:2",
          createdAt: "2026-06-15T11:00:00.000Z",
          updatedAt: "2026-06-15T12:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const workspace = await loadInterviewWorkspace("user-1")
    const canonical = COMMON_INTERVIEW_QUESTIONS_BY_KEY.get("proudest-achievement")

    expect(canonical).toBeDefined()
    expect(workspace.questions.find((question) => question.key === "proudest-achievement")).toMatchObject({
      id: "question-db-proud",
      key: "proudest-achievement",
      text: canonical?.text,
      category: canonical?.category,
      requiresStory: canonical?.requiresStory,
      evidenceTags: canonical?.evidenceTags,
      sourceRef: "proudest-achievement",
    })
    expect(workspace.questions.filter((question) => question.key === "proudest-achievement")).toHaveLength(1)
    expect(workspace.questions.slice(-2).map((question) => question.id)).toEqual([
      "question-db-b",
      "question-db-a",
    ])
  })

  it("marks current CV facts as current and orders ties deterministically", async () => {
    const cv = {
      summary: "Built useful products.",
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
    const currentRef = extractProfileFactDrafts(cv as never)[0]?.sourceRef ?? "cv:summary:profile-summary"

    db.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "fact-current",
          userId: "user-1",
          category: "summary",
          label: "Profile summary",
          detail: "Built useful products.",
          sourceType: "cv",
          sourceRef: currentRef,
          confirmedAt: "2026-06-15T08:00:00.000Z",
          createdAt: "2026-06-15T08:00:00.000Z",
          updatedAt: "2026-06-15T08:30:00.000Z",
        },
        {
          id: "fact-edited",
          userId: "user-1",
          category: "summary",
          label: "Profile summary",
          detail: "Edited detail",
          sourceType: "cv",
          sourceRef: `${currentRef}-v2`,
          confirmedAt: "2026-06-15T08:00:00.000Z",
          createdAt: "2026-06-15T08:00:00.000Z",
          updatedAt: "2026-06-15T08:30:00.000Z",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "cv-1",
          userId: "user-1",
          parsedJson: {
            summary: "Built useful products.",
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
          },
        },
      ])

    const workspace = await loadInterviewWorkspace("user-1")

    expect(currentRef).toBeTruthy()
    expect(workspace.facts.map((fact) => fact.id)).toEqual(["fact-edited", "fact-current"])
    expect(workspace.facts.find((fact) => fact.id === "fact-current")?.isCurrentSource).toBe(true)
    expect(workspace.facts.find((fact) => fact.id === "fact-edited")?.isCurrentSource).toBe(false)
  })

  it("reads story metadata, keeps imported sample stories unconfirmed, and orders ties deterministically", async () => {
    db.execute
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "answer-a",
          questionId: "question-1",
          applicationId: null,
          content: "Answer A",
          evidenceSnapshot: {
            factIds: [],
            storyIds: ["story-a"],
            generatedAt: "2026-06-15T09:00:00.000Z",
          },
          status: "saved",
          createdAt: "2026-06-15T09:00:00.000Z",
          updatedAt: "2026-06-15T09:05:00.000Z",
        },
        {
          id: "answer-b",
          questionId: "question-1",
          applicationId: null,
          content: "Answer B",
          evidenceSnapshot: {
            factIds: [],
            storyIds: ["story-a", "story-b"],
            generatedAt: "2026-06-15T09:00:00.000Z",
          },
          status: "saved",
          createdAt: "2026-06-15T09:00:00.000Z",
          updatedAt: "2026-06-15T09:05:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "fact-a",
          userId: "user-1",
          category: "summary",
          label: "Summary",
          detail: "Detail A",
          sourceType: "manual",
          sourceRef: "manual:1",
          confirmedAt: "2026-06-15T08:00:00.000Z",
          createdAt: "2026-06-15T08:00:00.000Z",
          updatedAt: "2026-06-15T08:30:00.000Z",
        },
        {
          id: "fact-b",
          userId: "user-1",
          category: "summary",
          label: "Summary",
          detail: "Detail B",
          sourceType: "manual",
          sourceRef: "manual:2",
          confirmedAt: "2026-06-15T08:00:00.000Z",
          createdAt: "2026-06-15T08:00:00.000Z",
          updatedAt: "2026-06-15T08:30:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "story-a",
          userId: "user-1",
          title: "Imported sample story",
          situation: "S",
          task: "T",
          action: "A",
          result: "R",
          tags: ["leadership"],
          sourceType: "manual",
          sourceRef: null,
          confirmedAt: null,
          createdAt: "2026-06-15T08:00:00.000Z",
          updatedAt: "2026-06-15T08:30:00.000Z",
        },
        {
          id: "story-b",
          userId: "user-1",
          title: "Discovered story",
          situation: "S",
          task: "T",
          action: "A",
          result: "R",
          tags: ["teamwork"],
          sourceType: "discovery",
          sourceRef: "story:discovery:1",
          confirmedAt: "2026-06-15T08:45:00.000Z",
          createdAt: "2026-06-15T08:00:00.000Z",
          updatedAt: "2026-06-15T08:30:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "app-a",
          userId: "user-1",
          jobId: "job-1",
          title: "Alpha",
          company: "ACME",
          createdAt: "2026-06-15T08:00:00.000Z",
        },
        {
          id: "app-b",
          userId: "user-1",
          jobId: null,
          title: null,
          company: null,
          createdAt: "2026-06-15T08:00:00.000Z",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "cv-1",
          userId: "user-1",
          parsedJson: {
            summary: "Built useful products.",
            experience: [],
            education: [],
            projects: [],
            skills: [],
            languages: [],
            certifications: [],
            activities: [],
          },
        },
      ])

    const workspace = await loadInterviewWorkspace("user-1")

    expect(workspace.answers.map((answer) => answer.id)).toEqual(["answer-b", "answer-a"])
    expect(workspace.stories.map((story) => story.id)).toEqual(["story-b", "story-a"])
    expect(workspace.stories.find((story) => story.id === "story-b")).toMatchObject({
      sourceType: "discovery",
      sourceRef: "story:discovery:1",
      confirmedAt: "2026-06-15T08:45:00.000Z",
      answerCount: 1,
    })
    expect(workspace.stories.find((story) => story.id === "story-a")).toMatchObject({
      sourceType: "manual",
      sourceRef: null,
      confirmedAt: null,
      answerCount: 2,
    })
    expect(workspace.facts.map((fact) => fact.id)).toEqual(["fact-b", "fact-a"])
    expect(workspace.applications.map((application) => application.id)).toEqual(["app-b", "app-a"])
  })
})

describe("loadPrimaryInterviewCvDrafts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns canonical drafts for the primary CV and ignores non-primary rows", async () => {
    const primaryCv = {
      summary: "Built useful products.",
      education: [],
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
      projects: [],
      skills: ["TypeScript"],
      languages: [],
      certifications: [],
      activities: [],
    }
    const nonPrimaryCv = {
      summary: "Ignore me",
      education: [],
      experience: [],
      projects: [],
      skills: [],
      languages: [],
      certifications: [],
      activities: [],
    }

    db.execute.mockImplementation(async (query) => {
      const sql = sqlText(query)
      if (sql.includes("FROM user_cvs") && sql.includes("is_primary = true")) {
        return [
          {
            id: "cv-primary",
            userId: "user-1",
            parsedJson: primaryCv,
          },
        ]
      }
      if (sql.includes("FROM user_cvs")) {
        return [
          {
            id: "cv-secondary",
            userId: "user-1",
            parsedJson: nonPrimaryCv,
          },
        ]
      }
      return []
    })

    const drafts = await loadPrimaryInterviewCvDrafts("user-1")

    expect(drafts).toEqual(extractProfileFactDrafts(primaryCv as never))
    expect(
      sqlText(db.execute.mock.calls.find(([query]) => sqlText(query).includes("FROM user_cvs"))?.[0]),
    ).toContain("is_primary = true")
  })

  it("returns no drafts when no primary CV exists", async () => {
    const nonPrimaryCv = {
      summary: "Ignore me",
      education: [],
      experience: [],
      projects: [],
      skills: [],
      languages: [],
      certifications: [],
      activities: [],
    }

    db.execute.mockImplementation(async (query) => {
      const sql = sqlText(query)
      if (sql.includes("FROM user_cvs") && sql.includes("is_primary = true")) {
        return []
      }
      if (sql.includes("FROM user_cvs")) {
        return [
          {
            id: "cv-secondary",
            userId: "user-1",
            parsedJson: nonPrimaryCv,
          },
        ]
      }
      return []
    })

    await expect(loadPrimaryInterviewCvDrafts("user-1")).resolves.toEqual([])
    expect(
      sqlText(db.execute.mock.calls.find(([query]) => sqlText(query).includes("FROM user_cvs"))?.[0]),
    ).toContain("is_primary = true")
  })
})
