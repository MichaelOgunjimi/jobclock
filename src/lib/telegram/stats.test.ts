import { describe, expect, it } from "vitest"
import { formatStats } from "./stats"

describe("formatStats", () => {
  it("summarises counts, weekly activity and response rate", () => {
    const text = formatStats({
      byStatus: { saved: 4, applied: 4, screening: 1, interview: 1, rejected: 2 },
      savedThisWeek: 3,
      appliedThisWeek: 2,
    })
    expect(text).toContain("12 applications")
    expect(text).toContain("saved 4 · applied 4 · screening 1 · interview 1 · offer 0")
    expect(text).toContain("Saved this week: 3")
    // 4 replies (screening+interview+rejected) of 8 non-saved applications
    expect(text).toContain("Response rate: 50% (4 of 8 applications got a reply)")
  })

  it("handles no applications and none sent yet", () => {
    expect(formatStats({ byStatus: {}, savedThisWeek: 0, appliedThisWeek: 0 })).toContain("No saved jobs yet")
    expect(formatStats({ byStatus: { saved: 1 }, savedThisWeek: 1, appliedThisWeek: 0 })).toContain("1 application\n")
    expect(formatStats({ byStatus: { saved: 1 }, savedThisWeek: 1, appliedThisWeek: 0 })).toContain("no applications sent yet")
  })
})
