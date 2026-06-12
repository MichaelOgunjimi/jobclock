import { describe, expect, it } from "vitest"
import sitemap from "./sitemap"

describe("sitemap", () => {
  it("includes the public extension privacy and support pages", () => {
    const entries = sitemap()
    const byUrl = new Map(entries.map((entry) => [entry.url, entry]))

    expect(
      byUrl.get(
        "https://jobclock.michaelogunjimi.com/extension/privacy"
      )
    ).toMatchObject({
      changeFrequency: "yearly",
      priority: 0.4,
    })
    expect(
      byUrl.get(
        "https://jobclock.michaelogunjimi.com/extension/support"
      )
    ).toMatchObject({
      changeFrequency: "monthly",
      priority: 0.5,
    })
  })
})
