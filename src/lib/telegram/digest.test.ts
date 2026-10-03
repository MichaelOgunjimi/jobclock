import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({ db: {} }))

import { formatDigest } from "./digest"

describe("formatDigest", () => {
  it("lists due follow-ups before the stats", () => {
    const text = formatDigest(
      [{ title: "Dev", company: "Acme", dueAt: "2026-10-01T09:00:00.000Z", url: "https://x.test/applications/dev" }],
      "STATS"
    )
    expect(text).toContain('• <a href="https://x.test/applications/dev">Dev</a> at Acme <i>(due 2026-10-01)</i>')
    expect(text.indexOf("Follow-ups due")).toBeLessThan(text.indexOf("STATS"))
    expect(text).toContain("/digest off")
  })

  it("escapes user-controlled titles and companies", () => {
    const text = formatDigest(
      [{ title: "<b>Dev</b> & co", company: "A<c>", dueAt: "2026-10-01T00:00:00.000Z", url: "https://x.test/a" }],
      "STATS"
    )
    expect(text).toContain("&lt;b&gt;Dev&lt;/b&gt; &amp; co")
    expect(text).not.toContain("<b>Dev</b>")
  })

  it("omits the follow-up section when nothing is due", () => {
    expect(formatDigest([], "STATS")).not.toContain("Follow-ups due")
  })
})
