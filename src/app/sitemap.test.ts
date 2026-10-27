import { describe, expect, it } from "vitest"
import sitemap from "./sitemap"

describe("sitemap", () => {
  it("includes the public extension privacy and support pages", () => {
    const entries = sitemap()
    const byUrl = new Map(entries.map((entry) => [entry.url, entry]))

    expect(
      byUrl.get(
        "https://jobclock.dev/extension/privacy"
      )
    ).toMatchObject({
      changeFrequency: "yearly",
      priority: 0.4,
    })
    expect(
      byUrl.get(
        "https://jobclock.dev/extension/support"
      )
    ).toMatchObject({
      changeFrequency: "monthly",
      priority: 0.5,
    })

    expect(byUrl.get("https://jobclock.dev/pricing")).toMatchObject({
      changeFrequency: "monthly",
      priority: 0.8,
    })

    for (const path of ["privacy", "terms", "cookies"]) {
      expect(
        byUrl.get(`https://jobclock.dev/${path}`)
      ).toMatchObject({ changeFrequency: "yearly" })
    }
  })
})
