import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { LIMITS, limitMessage, MAX_BATCH_JOBS, MAX_CV_CHARS, MAX_INTERVIEW_CHARS, MAX_LETTER_CHARS, MAX_LINK_CHARS, MAX_NAME_CHARS, MAX_PHONE_CHARS, MAX_PRIVATE_LIST, MAX_PROFILE_LIST_ITEM_CHARS, MAX_PROFILE_LIST_ITEMS, MAX_TARGET_SALARY, MCP_AUTH_FAILURES_PER_MINUTE, MCP_MAX_BODY_BYTES, MCP_REQUESTS_PER_MINUTE } from "./limits"

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

describe("limits of the profile, CV and interview tools", () => {
  const byName = (name: string) => LIMITS.find((limit) => limit.name === name)!

  it("every cap is named in the limits list with its reason, so Settings and the docs show it", () => {
    expect(byName("Profile and CV text returned").value).toContain("40,000")
    expect(byName("Profile and CV text returned").value).toContain("12,000")
    expect(byName("Profile and CV text returned").reason).toMatch(/truncated/)
    expect(byName("Profile and interview list size").value).toContain(String(MAX_PRIVATE_LIST))
    const edits = byName("Profile edit lengths").value
    for (const number of [MAX_NAME_CHARS, MAX_PHONE_CHARS, MAX_LINK_CHARS, MAX_PROFILE_LIST_ITEMS, MAX_PROFILE_LIST_ITEM_CHARS]) expect(edits).toContain(String(number))
    expect(edits).toContain(MAX_TARGET_SALARY.toLocaleString("en-GB"))
    expect([MAX_CV_CHARS, MAX_LETTER_CHARS, MAX_INTERVIEW_CHARS]).toEqual([40_000, 12_000, 40_000])
  })

  it("are shown to the owner in Settings", () => {
    for (const name of ["Profile and CV text returned", "Profile and interview list size", "Profile edit lengths"]) expect(byName(name).owner).toBe(true)
  })

  it("the story and about-me lengths are the interview workspace's own, imported rather than copied", async () => {
    const validation = await import("@/lib/interview/validation")
    expect(byName("Profile edit lengths").value).toContain(`story title ${validation.MAX_STORY_TITLE_LENGTH}`)
    expect(byName("Profile edit lengths").value).toContain(`each story field ${validation.MAX_STORY_FIELD_LENGTH.toLocaleString("en-GB")}`)
    expect(byName("Profile edit lengths").value).toContain(`${validation.MAX_TAGS} tags of ${validation.MAX_TAG_LENGTH}`)
    expect(byName("Profile edit lengths").value).toContain(`about-me label ${validation.MAX_FACT_LABEL_LENGTH}, detail ${validation.MAX_FACT_DETAIL_LENGTH.toLocaleString("en-GB")}`)
  })
})
