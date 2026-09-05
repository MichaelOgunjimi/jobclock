import { describe, expect, it } from "vitest"
import { applicationPath } from "./path"
import { createApplicationSlug, slugifyApplicationTitle } from "./slug"

describe("application slugs", () => {
  it("creates a readable slug from the job title", () => {
    expect(createApplicationSlug("Senior Software Engineer", "k7m2q9")).toBe(
      "senior-software-engineer-k7m2q9",
    )
  })

  it("normalizes punctuation and accented characters", () => {
    expect(slugifyApplicationTitle("Développeur C++ / Platform")).toBe(
      "developpeur-c-platform",
    )
  })

  it("uses a safe fallback and builds nested paths", () => {
    expect(createApplicationSlug("---", "abc123")).toBe("application-abc123")
    expect(applicationPath("software-engineer-abc123", "/cv")).toBe(
      "/applications/software-engineer-abc123/cv",
    )
  })
})
