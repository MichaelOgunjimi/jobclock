import { describe, it, expect } from "vitest"
import { EXPERIENCE_LEVELS } from "@/app/(dashboard)/profile/profile-tabs"

// The expected keys for EXPERIENCE_KEYWORDS in jobs-feed.tsx (not exported)
const EXPECTED_EXPERIENCE_KEYWORDS_KEYS = [
  "entry_level",
  "graduate",
  "junior",
  "mid",
  "senior",
  "lead",
]

// The expected keys for ADZUNA_WHAT_OR in search/route.ts (not exported)
const EXPECTED_ADZUNA_WHAT_OR_KEYS = [
  "entry_level",
  "graduate",
  "junior",
  "mid",
  "senior",
  "lead",
]

// The expected keys for CAREERJET_TERM in search/route.ts (not exported)
const EXPECTED_CAREERJET_TERM_KEYS = [
  "entry_level",
  "graduate",
  "junior",
  "mid",
  "senior",
  "lead",
]

describe("EXPERIENCE_LEVELS export from profile-tabs", () => {
  const values = EXPERIENCE_LEVELS.map((l) => l.value)

  it("includes 'mid' (not 'mid_level')", () => {
    expect(values).toContain("mid")
  })

  it("does not include 'mid_level'", () => {
    expect(values).not.toContain("mid_level")
  })
})

describe("EXPERIENCE_LEVELS values are a subset of the maps in jobs-feed and search route", () => {
  const values = EXPERIENCE_LEVELS.map((l) => l.value)

  it("every EXPERIENCE_LEVELS value is a key in EXPERIENCE_KEYWORDS", () => {
    for (const v of values) {
      expect(EXPECTED_EXPERIENCE_KEYWORDS_KEYS).toContain(v)
    }
  })

  it("every EXPERIENCE_LEVELS value is a key in ADZUNA_WHAT_OR", () => {
    for (const v of values) {
      expect(EXPECTED_ADZUNA_WHAT_OR_KEYS).toContain(v)
    }
  })

  it("every EXPERIENCE_LEVELS value is a key in CAREERJET_TERM", () => {
    for (const v of values) {
      expect(EXPECTED_CAREERJET_TERM_KEYS).toContain(v)
    }
  })
})
