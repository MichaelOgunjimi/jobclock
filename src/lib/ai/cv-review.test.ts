import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AiActionClient } from "./action"
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

const generate = vi.fn()
const ai = { generate } as unknown as AiActionClient

describe("reviewCv", () => {
  beforeEach(() => {
  })

  it("returns parsed findings when the LLM returns valid JSON", async () => {
    generate.mockResolvedValueOnce(
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

    const findings = await reviewCv(sampleCv, ai)

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
    generate.mockResolvedValueOnce("this is not json at all")

    await expect(reviewCv(sampleCv, ai)).rejects.toThrow(/unparseable/i)
  })

  it("throws when the LLM returns JSON with an invalid finding shape", async () => {
    generate.mockResolvedValueOnce(
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

    await expect(reviewCv(sampleCv, ai)).rejects.toThrow(/invalid finding/i)
  })

  it("returns an empty array when the LLM finds no issues", async () => {
    generate.mockResolvedValueOnce(JSON.stringify({ findings: [] }))

    await expect(reviewCv(sampleCv, ai)).resolves.toEqual([])
  })
})
