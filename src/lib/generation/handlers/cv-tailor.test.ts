import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({ db: { insert: vi.fn() } }))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("./cv-tailor-context", () => ({ loadCvTailorContext: vi.fn() }))
vi.mock("@/lib/ai", () => ({ resolveAiConfig: vi.fn(), generateText: vi.fn() }))
vi.mock("@/lib/ai/extract-json", () => ({ extractJson: vi.fn((v: unknown) => v) }))
vi.mock("@/lib/cv/normalize", () => ({ normalizeObjectStrings: vi.fn((v: unknown) => v) }))
vi.mock("@/lib/ai/prompts", () => ({
  STAGE_B_SYSTEM_PROMPT: "sysB",
  buildStageBUserPrompt: vi.fn(() => "usrB"),
  STAGE_C_SYSTEM_PROMPT: "sysC",
  buildStageCUserPrompt: vi.fn(() => "usrC"),
  STAGE_D_SYSTEM_PROMPT: "sysD",
  buildStageDUserPrompt: vi.fn(() => "usrD"),
  STAGE_E_SYSTEM_PROMPT: "sysE",
  buildStageEUserPrompt: vi.fn(() => "usrE"),
}))
vi.mock("@/lib/ai/cv-tailoring-schemas", () => ({
  jobAnalysisSchema: { safeParse: vi.fn() },
  cvMatchAnalysisSchema: { safeParse: vi.fn() },
  cvTailoringPlanSchema: { safeParse: vi.fn() },
  tailoredCvResultSchema: { safeParse: vi.fn() },
}))

import { loadCvTailorContext } from "./cv-tailor-context"
import { resolveAiConfig, generateText } from "@/lib/ai"
import {
  jobAnalysisSchema,
  cvMatchAnalysisSchema,
  cvTailoringPlanSchema,
  tailoredCvResultSchema,
} from "@/lib/ai/cv-tailoring-schemas"
import { cvTailorHandler } from "./cv-tailor"

const JOB = { id: "job-1", userId: "user-1", applicationId: "app-1", kind: "cv_tailor" } as never

const CTX = {
  userId: "user-1",
  applicationId: "app-1",
  title: "Engineer",
  company: "ACME",
  location: "London",
  description: "JD text",
  cvJson: '{"skills":["TypeScript"]}',
  preferences: { ai_provider: "openai" },
}

const JOB_ANALYSIS = { required_skills: ["TypeScript"], nice_to_have_skills: [], key_responsibilities: [] }
const MATCH_ANALYSIS = { matched_keywords: ["TypeScript"], missing_keywords: [], match_summary: "good" }
const TAILOR_PLAN = { instructions: [] }
const TAILOR_RESULT = {
  cv: { name: "Alice" },
  ats_match_estimate: { score: 85, basis: "matched" },
  matched_keywords: ["TypeScript"],
  missing_keywords: [],
  match_summary: "great",
}

describe("cvTailorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadCvTailorContext).mockResolvedValue(CTX as never)
    vi.mocked(resolveAiConfig).mockReturnValue({ settings: { provider: "openai", model: "gpt-4.1" }, apiKey: "k" } as never)
    vi.mocked(generateText).mockResolvedValue("{}")
    vi.mocked(jobAnalysisSchema.safeParse).mockReturnValue({ success: true, data: JOB_ANALYSIS } as never)
    vi.mocked(cvMatchAnalysisSchema.safeParse).mockReturnValue({ success: true, data: MATCH_ANALYSIS } as never)
    vi.mocked(cvTailoringPlanSchema.safeParse).mockReturnValue({ success: true, data: TAILOR_PLAN } as never)
    vi.mocked(tailoredCvResultSchema.safeParse).mockReturnValue({ success: true, data: TAILOR_RESULT } as never)
  })

  it("runs 4 stages, inserts into customized_cvs, returns id", async () => {
    const returning = vi.fn().mockResolvedValue([{ id: "cv-new" }])
    db.insert.mockReturnValue({ values: () => ({ returning }) })

    const resultRef = await cvTailorHandler(JOB)

    expect(generateText).toHaveBeenCalledTimes(4)
    expect(db.insert).toHaveBeenCalled()
    expect(resultRef).toBe("cv-new")
  })

  it("throws on LLM failure so dispatcher marks the job failed", async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error("Stage B timeout"))
    db.insert.mockReturnValue({ values: () => ({ returning: vi.fn().mockResolvedValue([{ id: "x" }]) }) })

    await expect(cvTailorHandler(JOB)).rejects.toThrow("Stage B timeout")
  })

  it("throws on schema validation failure", async () => {
    vi.mocked(jobAnalysisSchema.safeParse).mockReturnValue({
      success: false,
      error: { issues: [{ path: ["field"], message: "required" }] },
    } as never)

    await expect(cvTailorHandler(JOB)).rejects.toThrow("Stage B validation failed")
  })
})
