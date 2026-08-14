import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({ db: { select: vi.fn() } }))
vi.mock("@/lib/db", () => ({ db }))

import { loadCvTailorContext } from "./cv-tailor-context"

const JOB = { id: "job-1", userId: "user-1", applicationId: "app-1", kind: "cv_tailor" } as never

function selectOnce(rows: unknown[]) {
  db.select.mockReturnValueOnce({
    from: () => ({
      leftJoin: () => ({ where: vi.fn().mockResolvedValue(rows) }),
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

const APP_ROW = {
  selectedCvId: null,
  customDescription: null,
  customTitle: null,
  customCompany: null,
  customLocation: null,
  title: "Engineer",
  company: "ACME",
  location: "London",
  description: "JD text",
}
const PROFILE_ROW = { preferences: { ai_provider: "openai" } }
const CV_ROW = { parsedJson: { skills: ["TypeScript"] } }

describe("loadCvTailorContext", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns context with application, profile, and CV json", async () => {
    selectOnce([APP_ROW])         // app+job
    selectOnce([PROFILE_ROW])    // profile
    selectOnce([CV_ROW])         // cv (primary)

    const ctx = await loadCvTailorContext(JOB)

    expect(ctx.userId).toBe("user-1")
    expect(ctx.title).toBe("Engineer")
    expect(ctx.location).toBe("London")
    expect(ctx.description).toBe("JD text")
    expect(ctx.cvJson).toContain("TypeScript")
    expect(ctx.preferences).toEqual({
      ai_provider: "openai",
      allow_platform_ai_key: false,
    })
  })

  it("throws when application is not found", async () => {
    selectOnce([])
    selectOnce([PROFILE_ROW])

    await expect(loadCvTailorContext(JOB)).rejects.toThrow("Application not found")
  })

  it("uses corrected application details instead of extracted job values", async () => {
    selectOnce([{
      ...APP_ROW,
      customTitle: "Senior Engineer",
      customCompany: "Correct ACME",
      customLocation: "Remote",
    }])
    selectOnce([PROFILE_ROW])
    selectOnce([CV_ROW])

    const ctx = await loadCvTailorContext(JOB)

    expect(ctx).toMatchObject({
      title: "Senior Engineer",
      company: "Correct ACME",
      location: "Remote",
    })
  })

  it("throws when no CV is available", async () => {
    selectOnce([APP_ROW])
    selectOnce([PROFILE_ROW])
    selectOnce([])

    await expect(loadCvTailorContext(JOB)).rejects.toThrow("No CV found")
  })

  it("throws when no job description is available", async () => {
    selectOnce([{ ...APP_ROW, description: null, customDescription: null }])
    selectOnce([PROFILE_ROW])

    await expect(loadCvTailorContext(JOB)).rejects.toThrow("No job description")
  })
})
