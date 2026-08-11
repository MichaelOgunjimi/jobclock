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
import { cvTailorHandler, selectTailoredSkills } from "./cv-tailor"

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

  it("persists only relevant skills selected from the original CV", async () => {
    vi.mocked(loadCvTailorContext).mockResolvedValue({
      ...CTX,
      cvJson: JSON.stringify({
        skills: [
          "Python",
          "FastAPI",
          "Docker",
          "REST APIs",
          "Git",
          "CI/CD",
          "JavaScript",
          "HTML",
          "CSS",
          "Attention to detail",
          "Teamwork",
          "Problem-solving",
        ],
      }),
    } as never)
    vi.mocked(cvTailoringPlanSchema.safeParse).mockReturnValue({
      success: true,
      data: {
        skills_plan: {
          prioritize: ["Python", "REST APIs", "FastAPI"],
          keep: ["Docker", "Git", "CI/CD", "Attention to detail", "Teamwork", "Problem-solving"],
          add_if_present_in_cv: ["Distributed Systems"],
        },
      },
    } as never)
    vi.mocked(tailoredCvResultSchema.safeParse).mockReturnValue({
      success: true,
      data: {
        ...TAILOR_RESULT,
        cv: {
          name: "Alice",
          skills: [
            "Python",
            "AI-powered development tools",
            "FastAPI",
            "Distributed Systems",
            "Collaborative Development Workflows",
            "full-stack",
            "ownership",
            "Attention to detail",
            "Teamwork",
            "Problem-solving",
          ],
        },
      },
    } as never)
    const returning = vi.fn().mockResolvedValue([{ id: "cv-new" }])
    const values = vi.fn(() => ({ returning }))
    db.insert.mockReturnValue({ values })

    await cvTailorHandler(JOB)

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      cvJson: expect.objectContaining({
        skills: ["Python", "REST APIs", "FastAPI", "Docker", "Git", "CI/CD", "JavaScript", "HTML", "CSS"],
      }),
    }))
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

  it("throws when context loader reports no CV so dispatcher marks job failed", async () => {
    vi.mocked(loadCvTailorContext).mockRejectedValueOnce(new Error("No CV found. Upload a CV first."))

    await expect(cvTailorHandler(JOB)).rejects.toThrow("No CV found. Upload a CV first.")
  })

  it("throws when resolveAiConfig has no API key so dispatcher marks job failed", async () => {
    vi.mocked(resolveAiConfig).mockImplementationOnce(() => {
      throw new Error("No API key configured.")
    })

    await expect(cvTailorHandler(JOB)).rejects.toThrow("No API key configured.")
  })
})

describe("selectTailoredSkills", () => {
  it("backfills genuine source skills until the CV contains at least 13", () => {
    const originalSkills = [
      "Python",
      "TypeScript",
      "React",
      "Next.js",
      "Node.js",
      "FastAPI",
      "Docker",
      "AWS",
      "PostgreSQL",
      "Redis",
      "Git",
      "CI/CD",
      "REST APIs",
      "HTML",
      "CSS",
    ]

    const result = selectTailoredSkills(
      JSON.stringify({ skills: originalSkills }),
      {
        skills_plan: {
          prioritize: ["TypeScript", "React"],
          keep: ["Next.js", "Node.js", "Docker"],
          add_if_present_in_cv: [],
          remove: [],
          ordering_strategy: "Role relevance first",
        },
      } as never,
      ["TypeScript", "React"],
    )

    expect(result).toHaveLength(13)
    expect(result.slice(0, 5)).toEqual(["TypeScript", "React", "Next.js", "Node.js", "Docker"])
    expect(result.every((skill) => originalSkills.includes(skill))).toBe(true)
  })
})
