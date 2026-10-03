import { describe, expect, it } from "vitest"
import { formatStats } from "./stats"

describe("formatStats", () => {
  it("summarises counts, weekly activity and response rate", () => {
    const text = formatStats({
      byStatus: { saved: 4, applied: 4, screening: 1, interview: 1, rejected: 2 },
      savedThisWeek: 3,
      appliedThisWeek: 2,
    })
    expect(text).toContain("12 applications tracked")
    expect(text).toContain("<pre>")
    expect(text).toMatch(/saved\s+4 /)
    expect(text).toContain("Saved 3  ·  📨 Applied 2")
    // 4 replies (screening+interview+rejected) of 8 non-saved applications
    expect(text).toContain("Response rate: 50%")
    expect(text).toContain("4 of 8 applications got a reply")
  })

  it("scales bars to the largest count and keeps a sliver for non-zero values", () => {
    const text = formatStats({ byStatus: { saved: 1, applied: 100 }, savedThisWeek: 0, appliedThisWeek: 0 })
    expect(text).toMatch(/applied\s+100 ██████████/)
    expect(text).toMatch(/saved\s+1 █░░░░░░░░░/)
    expect(text).toMatch(/offer\s+0 ░░░░░░░░░░/)
  })

  it("handles no applications and none sent yet", () => {
    expect(formatStats({ byStatus: {}, savedThisWeek: 0, appliedThisWeek: 0 })).toContain("No saved jobs yet.")
    expect(formatStats({ byStatus: { saved: 1 }, savedThisWeek: 1, appliedThisWeek: 0 })).toContain("1 application tracked")
    expect(formatStats({ byStatus: { saved: 1 }, savedThisWeek: 1, appliedThisWeek: 0 })).toContain("No applications sent yet")
  })
})
