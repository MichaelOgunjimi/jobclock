import { describe, expect, it } from "vitest"
import { toExternalProfileHref } from "./account-link-utils"

describe("toExternalProfileHref", () => {
  it("keeps safe absolute https urls", () => {
    expect(toExternalProfileHref("https://github.com/example")).toBe("https://github.com/example")
  })

  it("adds https to bare hostnames so clickable links still work", () => {
    expect(toExternalProfileHref("linkedin.com/in/example")).toBe("https://linkedin.com/in/example")
  })

  it("rejects unsafe schemes", () => {
    expect(toExternalProfileHref("javascript:alert(1)")).toBeNull()
  })

  it("rejects protocol-relative urls", () => {
    expect(toExternalProfileHref("//evil.example")).toBeNull()
  })
})
