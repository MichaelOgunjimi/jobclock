import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: { select: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/cover-letter/cv-context", () => ({
  buildCvContext: vi.fn((cv) => (cv ? "cv-text" : "")),
}))

import { loadCoverLetterContext } from "./cover-letter-context"

const JOB = {
  id: "job-1",
  userId: "user-1",
  applicationId: "app-1",
  kind: "cover_letter",
} as never

function selectOnce(rows: unknown[]) {
  db.select.mockReturnValueOnce({
    from: () => ({
      leftJoin: () => ({ where: vi.fn().mockResolvedValue(rows) }),
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

const APP_ROW = {
  selectedCvId: "cv-1",
  structureId: "str-1",
  coverLetterTone: "enthusiastic",
  customDescription: null,
  title: "Engineer",
  company: "ACME",
  description: "JD text",
}
const PROFILE_ROW = { preferences: { ai_provider: "openai" } }
const CV_ROW = { parsedJson: { skills: ["TypeScript"] } }
const STRUCTURE_ROW = { content: "template content", defaultTone: "professional" }
const RESEARCH_ROW = { researchContent: "ACME ships APIs" }

describe("loadCoverLetterContext", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns full context when selectedCvId and structureId are set", async () => {
    // Round 1: application, profile
    selectOnce([APP_ROW])
    selectOnce([PROFILE_ROW])
    // Round 2: CV, structure, research
    selectOnce([CV_ROW])
    selectOnce([STRUCTURE_ROW])
    selectOnce([RESEARCH_ROW])

    const ctx = await loadCoverLetterContext(JOB)

    expect(ctx.userId).toBe("user-1")
    expect(ctx.applicationId).toBe("app-1")
    expect(ctx.title).toBe("Engineer")
    expect(ctx.company).toBe("ACME")
    expect(ctx.description).toBe("JD text")
    expect(ctx.tone).toBe("enthusiastic")
    expect(ctx.templateSnippet).toBe("template content")
    expect(ctx.companyResearch).toBe("ACME ships APIs")
    expect(ctx.cvContext).toBe("cv-text")
    expect(ctx.preferences).toEqual({ ai_provider: "openai" })
  })

  it("falls back to primary CV and built-in structure when neither is set on the application", async () => {
    const appNoCvNoStruct = {
      ...APP_ROW,
      selectedCvId: null,
      structureId: null,
      coverLetterTone: null,
    }
    // Round 1
    selectOnce([appNoCvNoStruct])
    selectOnce([PROFILE_ROW])
    // Round 2: primary CV (null structureId → built-in), research
    selectOnce([CV_ROW])
    selectOnce([{ content: "built-in", defaultTone: "conservative" }])
    selectOnce([])

    const ctx = await loadCoverLetterContext(JOB)

    expect(ctx.tone).toBe("conservative")
    expect(ctx.templateSnippet).toBe("built-in")
    expect(ctx.companyResearch).toBeUndefined()
    expect(ctx.cvContext).toBe("cv-text")
  })

  it("uses customDescription over jobs_cache description when set", async () => {
    const appWithCustomDesc = { ...APP_ROW, customDescription: "custom JD", description: "cache JD" }
    selectOnce([appWithCustomDesc])
    selectOnce([PROFILE_ROW])
    selectOnce([CV_ROW])
    selectOnce([STRUCTURE_ROW])
    selectOnce([])

    const ctx = await loadCoverLetterContext(JOB)

    expect(ctx.description).toBe("custom JD")
  })

  it("falls back to 'professional' tone when no app tone or structure default", async () => {
    const appNoTone = { ...APP_ROW, coverLetterTone: null }
    selectOnce([appNoTone])
    selectOnce([PROFILE_ROW])
    selectOnce([CV_ROW])
    selectOnce([{ content: "tmpl", defaultTone: null }])
    selectOnce([])

    const ctx = await loadCoverLetterContext(JOB)

    expect(ctx.tone).toBe("professional")
  })

  it("throws when application is not found", async () => {
    selectOnce([])
    selectOnce([PROFILE_ROW])

    await expect(loadCoverLetterContext(JOB)).rejects.toThrow("Application not found")
  })

  it("throws when no job description is available", async () => {
    const appNoDesc = { ...APP_ROW, customDescription: null, description: null }
    selectOnce([appNoDesc])
    selectOnce([PROFILE_ROW])

    await expect(loadCoverLetterContext(JOB)).rejects.toThrow("No job description")
  })
})
