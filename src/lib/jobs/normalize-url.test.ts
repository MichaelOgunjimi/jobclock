import { describe, expect, it } from "vitest"
import { jobUrlKey, normalizeJobUrl } from "./normalize-url"

describe("normalizeJobUrl", () => {
  it.each([
    ["https://Jobs.Example.com/view/123/", "https://jobs.example.com/view/123"],
    ["https://jobs.example.com/view/123#apply", "https://jobs.example.com/view/123"],
    ["https://jobs.example.com/view/123?utm_source=x&UTM_campaign=y&fbclid=z&trackingId=1&refId=2", "https://jobs.example.com/view/123"],
    ["https://jobs.example.com:443/view/123", "https://jobs.example.com/view/123"],
    ["  https://jobs.example.com/view/123?b=2&a=1&gclid=q  ", "https://jobs.example.com/view/123?a=1&b=2"],
    ["https://boards.example.com/acme?gh_jid=987&gh_src=abc", "https://boards.example.com/acme?gh_jid=987"],
  ])("%s -> %s", (input, expected) => expect(normalizeJobUrl(input)).toBe(expected))

  it("keeps parameters that identify the job", () => {
    expect(normalizeJobUrl("https://x.example/jobs/search/?currentJobId=42")).toBe("https://x.example/jobs/search?currentJobId=42")
  })

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "ftp://example.com/job",
    "https://user:pass@example.com/job",
    "not a url",
    "",
  ])("rejects %s", (input) => expect(normalizeJobUrl(input)).toBeNull())

  it("compares http and https links to the same posting as equal", () => {
    expect(jobUrlKey(normalizeJobUrl("http://a.example/j/1/")!)).toBe(jobUrlKey(normalizeJobUrl("https://A.example/j/1")!))
  })
})
