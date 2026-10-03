import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({ db: {} }))

import { formatDigest } from "./digest"

describe("formatDigest", () => {
  it("lists due follow-ups before the stats", () => {
    const text = formatDigest(
      [{ title: "Dev", company: "Acme", dueAt: "2026-10-01T09:00:00.000Z", url: "https://x.test/applications/dev" }],
      "STATS"
    )
    expect(text).toContain("Follow-ups due:\n• Dev at Acme (due 2026-10-01)\n  https://x.test/applications/dev")
    expect(text.indexOf("Follow-ups due")).toBeLessThan(text.indexOf("STATS"))
    expect(text).toContain("/digest off")
  })

  it("omits the follow-up section when nothing is due", () => {
    expect(formatDigest([], "STATS")).not.toContain("Follow-ups due")
  })
})
