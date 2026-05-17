import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: { select: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))

import { loadCompanyResearchContext } from "./company-research-context"

const JOB = {
  id: "job-1",
  userId: "user-1",
  applicationId: "app-1",
  kind: "company_research",
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
  company: "ACME",
  title: "Engineer",
  description: "JD text",
  customDescription: null,
}
const PROFILE_ROW = { preferences: { ai_provider: "openai" } }

describe("loadCompanyResearchContext", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns context with application and profile data", async () => {
    selectOnce([APP_ROW])
    selectOnce([PROFILE_ROW])

    const ctx = await loadCompanyResearchContext(JOB)

    expect(ctx.userId).toBe("user-1")
    expect(ctx.applicationId).toBe("app-1")
    expect(ctx.company).toBe("ACME")
    expect(ctx.title).toBe("Engineer")
    expect(ctx.description).toBe("JD text")
    expect(ctx.preferences).toEqual({ ai_provider: "openai" })
  })

  it("prefers customDescription over jobs_cache description", async () => {
    selectOnce([{ ...APP_ROW, customDescription: "override JD" }])
    selectOnce([PROFILE_ROW])

    const ctx = await loadCompanyResearchContext(JOB)

    expect(ctx.description).toBe("override JD")
  })

  it("throws when application is not found", async () => {
    selectOnce([])
    selectOnce([PROFILE_ROW])

    await expect(loadCompanyResearchContext(JOB)).rejects.toThrow("Application not found")
  })
})
