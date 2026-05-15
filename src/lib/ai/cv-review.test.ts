import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("./index", async () => {
  const actual = await vi.importActual<typeof import("./index")>("./index")
  return {
    ...actual,
    resolveAiConfig: vi.fn(),
    generateText: vi.fn(),
  }
})

import { resolveAiConfig, generateText } from "./index"
import { reviewCv } from "./cv-review"
import type { CvData } from "@/lib/supabase/database.types"

const sampleCv: CvData = {
  name: "Alex Smith",
  experience: [
    {
      company: "Acme Corp",
      title: "Junior Developer",
      start_date: "2023-09",
      end_date: "2025-01",
      highlights: ["Responsible for updating the website"],
    },
  ],
  education: [],
  projects: [],
  skills: [],
  activities: [],
} as unknown as CvData

describe("reviewCv", () => {
  beforeEach(() => {
    vi.mocked(resolveAiConfig).mockReturnValue({
      settings: { provider: "openai", model: "gpt-4.1" },
      apiKey: "sk-test",
    })
  })

  it("returns parsed findings when the LLM returns valid JSON", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      JSON.stringify({
        findings: [
          {
            category: "weak_verb",
            severity: "high",
            location: {
              section: "experience",
              entryId: "Junior Developer at Acme Corp",
              bulletIndex: 0,
            },
            message: "Bullet starts with 'Responsible for' — a weak phrase.",
            suggestion: "Lead with a strong action verb and the outcome.",
          },
        ],
      }),
    )

    const findings = await reviewCv(sampleCv, null)

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      category: "weak_verb",
      severity: "high",
      location: {
        section: "experience",
        entryId: "Junior Developer at Acme Corp",
        bulletIndex: 0,
      },
    })
    expect(findings[0].message).toContain("Responsible for")
  })

  it("throws when the LLM returns unparseable JSON", async () => {
    vi.mocked(generateText).mockResolvedValueOnce("this is not json at all")

    await expect(reviewCv(sampleCv, null)).rejects.toThrow(/unparseable/i)
  })

  it("throws when the LLM returns JSON with an invalid finding shape", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      JSON.stringify({
        findings: [
          {
            category: "not_a_real_category",
            severity: "high",
            location: { section: "experience" },
            message: "x",
            suggestion: "y",
          },
        ],
      }),
    )

    await expect(reviewCv(sampleCv, null)).rejects.toThrow(/invalid finding/i)
  })

  it("returns an empty array when the LLM finds no issues", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(JSON.stringify({ findings: [] }))

    await expect(reviewCv(sampleCv, null)).resolves.toEqual([])
  })
})
