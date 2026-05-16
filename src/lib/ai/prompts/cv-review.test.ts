import { describe, expect, it } from "vitest"
import { CV_REVIEW_SYSTEM_PROMPT, buildCvReviewUserPrompt } from "./cv-review"

describe("CV_REVIEW_SYSTEM_PROMPT", () => {
  it("instructs the model to flag only evidenced issues (no fabrication)", () => {
    expect(CV_REVIEW_SYSTEM_PROMPT).toMatch(/never invent/i)
    expect(CV_REVIEW_SYSTEM_PROMPT).toMatch(/only flag issues that are evidenced/i)
  })

  it("scopes the review to content-level signals, not formatting", () => {
    expect(CV_REVIEW_SYSTEM_PROMPT).toMatch(/cannot observe/i)
    expect(CV_REVIEW_SYSTEM_PROMPT).toMatch(/font|page count|columns/i)
  })

  it("returns an empty findings array when nothing is wrong", () => {
    expect(CV_REVIEW_SYSTEM_PROMPT).toMatch(/empty findings array/i)
  })

  it("lists all defined finding categories so the model uses the right strings", () => {
    const categories = [
      "weak_verb",
      "missing_metric",
      "bullet_too_short",
      "bullet_too_long",
      "generic_filler",
      "summary_issue",
      "missing_date",
      "skills_section",
      "ats_hazard",
    ]
    for (const cat of categories) {
      expect(CV_REVIEW_SYSTEM_PROMPT).toContain(cat)
    }
  })

  it("requires a single raw JSON object as output", () => {
    expect(CV_REVIEW_SYSTEM_PROMPT).toMatch(/single raw json object/i)
  })
})

describe("buildCvReviewUserPrompt", () => {
  it("wraps the CV JSON in the candidate_cv tag", () => {
    const prompt = buildCvReviewUserPrompt('{"name":"Alex"}')
    expect(prompt).toContain("<candidate_cv>")
    expect(prompt).toContain('{"name":"Alex"}')
    expect(prompt).toContain("</candidate_cv>")
  })
})
