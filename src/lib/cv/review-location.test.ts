import { describe, expect, it } from "vitest"
import type { CvData } from "@/lib/supabase/database.types"
import type { CvReviewFinding } from "@/lib/ai/cv-review-schemas"
import { entryIdsForReview, findingKey, getFindingText, groundFindings, mergeDuplicateFindings, rewriteIsGrounded, setFindingText } from "./review-location"

const cv = {
  summary: "Developer with 3 years of experience.",
  experience: [
    { company: "Acme", title: "Developer", description: "", highlights: ["Responsible for the website", "Cut build time by 40%"] },
  ],
  projects: [{ name: "Tracker", description: "", highlights: ["Worked on a tracker"] }],
  education: [],
  skills: [],
} as CvData

const finding = (overrides: Partial<CvReviewFinding> = {}): CvReviewFinding => ({
  category: "weak_verb",
  severity: "high",
  location: { section: "experience", entryId: "Developer at Acme", bulletIndex: 0 },
  message: "Weak opener",
  suggestion: "Lead with a verb",
  ...overrides,
})

describe("getFindingText / setFindingText", () => {
  it("reads and replaces summary, experience and project text", () => {
    expect(getFindingText(cv, { section: "summary" })).toBe(cv.summary)
    expect(getFindingText(cv, { section: "experience", entryId: "developer at acme", bulletIndex: 1 })).toBe("Cut build time by 40%")
    expect(getFindingText(cv, { section: "projects", entryId: "Tracker", bulletIndex: 0 })).toBe("Worked on a tracker")

    const next = setFindingText(cv, { section: "experience", entryId: "Developer at Acme", bulletIndex: 0 }, "Built the website")
    expect(next?.experience?.[0].highlights).toEqual(["Built the website", "Cut build time by 40%"])
    expect(cv.experience?.[0].highlights?.[0]).toBe("Responsible for the website")
    expect(setFindingText(cv, { section: "summary" }, "New")?.summary).toBe("New")
  })

  it("returns undefined / null for locations that do not exist", () => {
    expect(getFindingText(cv, { section: "experience", entryId: "Nobody at Nowhere", bulletIndex: 0 })).toBeUndefined()
    expect(getFindingText(cv, { section: "experience", entryId: "Developer at Acme", bulletIndex: 9 })).toBeUndefined()
    expect(getFindingText(cv, { section: "skills" })).toBeUndefined()
    expect(setFindingText(cv, { section: "experience", entryId: "Developer at Acme", bulletIndex: 9 }, "x")).toBeNull()
  })

  it("resolves a missing entryId only when the section has a single entry", () => {
    expect(getFindingText(cv, { section: "experience", bulletIndex: 0 })).toBe("Responsible for the website")
    const two = { ...cv, experience: [...cv.experience!, cv.experience![0]] } as CvData
    expect(getFindingText(two, { section: "experience", bulletIndex: 0 })).toBeUndefined()
  })
})

describe("rewriteIsGrounded", () => {
  it("allows rephrasing and numbers already in the source", () => {
    expect(rewriteIsGrounded("Cut build time by 40%", "Reduced build time by 40%")).toBe(true)
  })

  it("rejects invented numbers, empty and unchanged rewrites", () => {
    expect(rewriteIsGrounded("Responsible for the website", "Built the website for 10,000 users")).toBe(false)
    expect(rewriteIsGrounded("Cut build time by 40%", "Cut build time by 40% ")).toBe(false)
    expect(rewriteIsGrounded("Cut build time by 40%", "  ")).toBe(false)
  })

  it("lets a summary reuse numbers from elsewhere in the CV", () => {
    expect(rewriteIsGrounded("Developer.", "Developer, 3 years", JSON.stringify(cv))).toBe(true)
    expect(rewriteIsGrounded("Developer.", "Developer, 7 years", JSON.stringify(cv))).toBe(false)
  })
})

describe("groundFindings", () => {
  it("attaches original text, keeps a grounded rewrite and drops an invented one", () => {
    const [good, invented, unlocatable] = groundFindings(cv, [
      finding({ rewrite: "Built the website" }),
      finding({ location: { section: "projects", entryId: "Tracker", bulletIndex: 0 }, rewrite: "Built a tracker used by 500 people" }),
      finding({ category: "skills_section", location: { section: "skills" }, original: "model made this up", rewrite: "x" }),
    ])
    expect(good).toMatchObject({ original: "Responsible for the website", rewrite: "Built the website" })
    expect(invented.original).toBe("Worked on a tracker")
    expect(invented.rewrite).toBeUndefined()
    expect(unlocatable.original).toBeUndefined()
    expect(unlocatable.rewrite).toBeUndefined()
  })
})

describe("duplicate findings", () => {
  const metric = (overrides: Partial<CvReviewFinding> = {}) =>
    finding({
      category: "missing_metric",
      severity: "medium",
      location: { section: "projects", entryId: "Tracker", bulletIndex: 0 },
      ...overrides,
    })

  it("merges same category and location into one card, joining different text and keeping the top severity", () => {
    const merged = mergeDuplicateFindings([
      metric({ message: "No numbers", suggestion: "Add a count" }),
      metric({ severity: "high", message: "No scale", suggestion: "Add a count" }),
      metric({ location: { section: "projects", entryId: "tracker", bulletIndex: 0 }, message: "No numbers", suggestion: "Add a count" }),
      metric({ location: { section: "projects", entryId: "Tracker", bulletIndex: 1 } }),
      metric({ category: "weak_verb" }),
    ])
    expect(merged).toHaveLength(3)
    expect(merged[0]).toMatchObject({ severity: "high", message: "No numbers No scale", suggestion: "Add a count" })
  })

  it("keeps the more specific message when one contains the other", () => {
    const [one] = mergeDuplicateFindings([
      metric({ message: "No numbers" }),
      metric({ message: "No numbers or scale in this bullet" }),
    ])
    expect(one.message).toBe("No numbers or scale in this bullet")
  })

  it("is applied by groundFindings and is idempotent", () => {
    const grounded = groundFindings(cv, [metric(), metric({ message: "Other" })])
    expect(grounded).toHaveLength(1)
    expect(mergeDuplicateFindings(grounded)).toEqual(grounded)
  })
})

describe("findingKey", () => {
  it("is stable for the same finding and differs when the text differs", () => {
    expect(findingKey(finding({ original: "a" }))).toBe(findingKey(finding({ original: "a" })))
    expect(findingKey(finding({ original: "a" }))).not.toBe(findingKey(finding({ original: "b" })))
  })
})

describe("entries whose names collide", () => {
  const dup = {
    ...cv,
    experience: [
      { company: "Acme", title: "Developer", description: "", highlights: ["First role bullet"] },
      { company: "Acme", title: "Developer", description: "", highlights: ["Second role bullet"] },
    ],
    projects: [
      { name: "Tracker", description: "", highlights: ["First tracker"] },
      { name: "Tracker", description: "", highlights: ["Second tracker"] },
    ],
  } as CvData
  const exp = (entryId: string) => ({ section: "experience" as const, entryId, bulletIndex: 0 })
  const proj = (entryId: string) => ({ section: "projects" as const, entryId, bulletIndex: 0 })

  it("labels each colliding entry distinctly and leaves unique ones plain", () => {
    expect(entryIdsForReview(dup)).toEqual({
      experience: ["Developer at Acme (1)", "Developer at Acme (2)"],
      projects: ["Tracker (1)", "Tracker (2)"],
    })
    expect(entryIdsForReview(cv)).toEqual({ experience: ["Developer at Acme"], projects: ["Tracker"] })
  })

  it("reads the entry the label points at", () => {
    expect(getFindingText(dup, exp("Developer at Acme (2)"))).toBe("Second role bullet")
    expect(getFindingText(dup, exp("developer at acme (1)"))).toBe("First role bullet")
    expect(getFindingText(dup, proj("Tracker (2)"))).toBe("Second tracker")
  })

  it("still resolves plain names stored before suffixes existed, to the first entry", () => {
    expect(getFindingText(dup, exp("Developer at Acme"))).toBe("First role bullet")
    expect(getFindingText(dup, proj("Tracker"))).toBe("First tracker")
  })

  it("edits only the targeted entry", () => {
    const next = setFindingText(dup, exp("Developer at Acme (2)"), "Rewritten")
    expect(next?.experience?.map((e) => e.highlights)).toEqual([["First role bullet"], ["Rewritten"]])
    const nextProject = setFindingText(dup, proj("Tracker (2)"), "Rewritten")
    expect(nextProject?.projects?.map((p) => p.highlights)).toEqual([["First tracker"], ["Rewritten"]])
  })

  it("grounds and keeps one card per entry instead of merging them", () => {
    const grounded = groundFindings(dup, [
      finding({ location: exp("Developer at Acme (1)") }),
      finding({ location: exp("Developer at Acme (2)") }),
    ])
    expect(grounded.map((f) => f.original)).toEqual(["First role bullet", "Second role bullet"])
  })
})
