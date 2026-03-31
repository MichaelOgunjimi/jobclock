import { describe, it, expect } from "vitest"

// Inline the exact validation logic from route.ts
function validateNext(rawNext: string): string {
  return rawNext.startsWith("/") && !rawNext.startsWith("//")
    ? rawNext
    : "/dashboard"
}

describe("OAuth redirect validation", () => {
  it("keeps /dashboard as-is", () => {
    expect(validateNext("/dashboard")).toBe("/dashboard")
  })

  it("keeps /applications/123", () => {
    expect(validateNext("/applications/123")).toBe("/applications/123")
  })

  it("falls back to /dashboard for absolute URL", () => {
    expect(validateNext("https://evil.com")).toBe("/dashboard")
  })

  it("falls back to /dashboard for protocol-relative path", () => {
    expect(validateNext("//evil.com")).toBe("/dashboard")
  })

  it("falls back to /dashboard for javascript: scheme", () => {
    expect(validateNext("javascript:alert(1)")).toBe("/dashboard")
  })

  it("falls back to /dashboard for empty string", () => {
    expect(validateNext("")).toBe("/dashboard")
  })
})
