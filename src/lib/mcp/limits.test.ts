import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { LIMITS, limitMessage, MAX_BATCH_JOBS, MCP_AUTH_FAILURES_PER_MINUTE, MCP_MAX_BODY_BYTES, MCP_REQUESTS_PER_MINUTE } from "./limits"

const docs = readFileSync(resolve(process.cwd(), "docs/mcp-agent-access.md"), "utf8")

describe("limits inventory", () => {
  it("lists every limit with a value and a reason, and each one is in the docs table", () => {
    for (const limit of LIMITS) {
      expect(limit.reason.length, limit.name).toBeGreaterThan(20)
      expect(limit.value, limit.name).not.toBe("")
      expect(docs, `${limit.name} is missing from docs/mcp-agent-access.md`).toContain(`| ${limit.name} | ${limit.value} | ${limit.reason} |`)
    }
  })

  it("names unique limits", () => {
    expect(new Set(LIMITS.map((limit) => limit.name)).size).toBe(LIMITS.length)
  })

  it("keeps what defends the public endpoints and removes what protected nothing", () => {
    const status = (name: string) => LIMITS.find((limit) => limit.name === name)?.status
    for (const name of ["Failed sign-ins per IP", "Client registrations per IP", "OAuth token requests per IP", "Registration size", "Authorization code lifetime", "Access token lifetime", "Refresh token lifetime"]) {
      expect(status(name), name).toBe("kept")
    }
    expect(status("Active tokens per account")).toBe("removed")
    expect(status("Requests per minute")).toBe("raised")
    expect(status("Daily new applications")).toBe("owner-editable")
  })

  it("raises the request rate for an inbox-zero run and sizes the body for a full batch", () => {
    expect(MCP_REQUESTS_PER_MINUTE).toBe(120)
    expect(MCP_AUTH_FAILURES_PER_MINUTE).toBe(20)
    expect(MAX_BATCH_JOBS * 20_000).toBeLessThan(MCP_MAX_BODY_BYTES) // 20 jobs at the longest stored description fit
  })

  it("an error says what, why and how to change it", () => {
    const message = limitMessage("Too many", "It protects the server.")
    expect(message).toContain("Too many.")
    expect(message).toContain("It protects the server.")
    expect(message).toContain("src/lib/mcp/limits.ts")
    expect(message).toContain("docs/mcp-agent-access.md")
  })
})

describe("limits that live next to their tools", () => {
  it("match the numbers the inbox tools enforce", async () => {
    vi.doMock("@/lib/db", async () => ({ db: (await import("./fake-db")).fakeDb }))
    const inbox = await import("./inbox-tools")
    expect(inbox.MAX_STATUS_BATCH).toBe(25)
    expect(inbox.MAX_SNOOZE_DAYS).toBe(365)
    expect(inbox.MAX_RESEARCH_CHARS).toBe(12_000)
    const byName = (name: string) => LIMITS.find((limit) => limit.name === name)!.value
    expect(byName("Status changes per batch call")).toContain("25")
    expect(byName("Snooze length")).toContain("365")
    expect(byName("Company research text")).toContain("12,000")
  })
})
