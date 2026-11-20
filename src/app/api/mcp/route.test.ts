import { beforeEach, describe, expect, it, vi } from "vitest"

const { authenticateApiToken, authenticateOAuthAccessToken, mcpRateLimit, mcpAuthFailureLimit, listApplications, setFollowUp, addApplication } = vi.hoisted(() => ({
  authenticateApiToken: vi.fn(),
  authenticateOAuthAccessToken: vi.fn(),
  mcpRateLimit: { limit: vi.fn() },
  mcpAuthFailureLimit: { limit: vi.fn() },
  listApplications: vi.fn(),
  setFollowUp: vi.fn(),
  addApplication: vi.fn(),
}))

vi.mock("@/lib/mcp/tokens", () => ({ authenticateApiToken }))
vi.mock("@/lib/oauth/tokens", () => ({ authenticateOAuthAccessToken }))
vi.mock("@/lib/rate-limit", () => ({ mcpRateLimit, mcpAuthFailureLimit }))
vi.mock("@/lib/db", () => ({ db: {} }))
vi.mock("@/lib/mcp/job-tools", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/mcp/job-tools")>()), addApplication }))
vi.mock("@/lib/mcp/tools", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/mcp/tools")>()), listApplications, setFollowUp }))

import { currentConnection } from "@/lib/mcp/connection-context"
import { DELETE, GET, POST } from "./route"

const FULL_TOKEN = { tokenId: "t1", userId: "user-a", scopes: ["applications:read", "applications:write"], dailyCreateCap: 100 }
const READ_TOKEN = { ...FULL_TOKEN, scopes: ["applications:read"] }

const rpc = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify(body),
  })

const callTool = (name: string, args: Record<string, unknown>) => ({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } })

describe("/api/mcp", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mcpRateLimit.limit.mockResolvedValue({ success: true })
    mcpAuthFailureLimit.limit.mockResolvedValue({ success: true })
    authenticateApiToken.mockResolvedValue(null)
    authenticateOAuthAccessToken.mockResolvedValue(null)
    listApplications.mockResolvedValue({ data: { count: 0, applications: [] } })
    setFollowUp.mockResolvedValue({ data: {} })
    addApplication.mockResolvedValue({ data: { created: true } })
  })

  it.each([
    ["no Authorization header", {}],
    ["a non-bearer scheme", { authorization: "Basic abc" }],
    ["an empty bearer", { authorization: "Bearer " }],
    ["an unknown or revoked token", { authorization: "Bearer jc_revoked" }],
    ["an expired or revoked OAuth access token", { authorization: "Bearer jat_expired" }],
  ])("401s with %s", async (_name, headers) => {
    const response = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, headers))
    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate")).toContain("Bearer")
    expect(listApplications).not.toHaveBeenCalled()
  })

  it("points unauthenticated clients at the protected resource metadata (RFC 9728), keeping the realm", async () => {
    const response = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }))
    const header = response.headers.get("www-authenticate") ?? ""
    expect(header).toContain('realm="jobclock"')
    expect(header).toContain('resource_metadata="https://jobclock.dev/.well-known/oauth-protected-resource/api/mcp"')
    expect(header).not.toContain("error=")
  })

  it("reports invalid_token when a credential was presented but is not valid", async () => {
    const response = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: "Bearer jat_expired" }))
    expect(response.headers.get("www-authenticate")).toContain('error="invalid_token"')
  })

  describe("OAuth access tokens", () => {
    const grant = (scopes: string[], resource = "https://jobclock.dev/api/mcp") => ({ userId: "user-a", scopes, grantId: "g1", resource, dailyCreateCap: 100 })
    const toolNames = async (headers: Record<string, string>) =>
      ((await (await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, headers))).json()).result.tools as { name: string }[]).map((tool) => tool.name).sort()

    it("a read-only grant lists only the read tools", async () => {
      authenticateOAuthAccessToken.mockResolvedValue(grant(["applications:read"]))
      expect(await toolNames({ authorization: "Bearer jat_ok" })).toEqual([
        "check_job_exists", "get_application", "get_application_activity", "get_company_research", "get_credits", "get_job_preferences", "get_pipeline_summary",
        "list_applications", "list_cvs", "list_due", "list_stale_applications", "list_upcoming_deadlines", "list_upcoming_interviews",
      ])
    })

    it("a read-only grant cannot call a write tool, and nothing is written", async () => {
      authenticateOAuthAccessToken.mockResolvedValue(grant(["applications:read"]))
      const body = await (await POST(rpc(callTool("set_follow_up", { application_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", note: "x" }), { authorization: "Bearer jat_ok" }))).json()
      expect(body.result?.isError ?? Boolean(body.error)).toBe(true)
      expect(setFollowUp).not.toHaveBeenCalled()
    })

    const job = { url: "https://example.com/jobs/1", title: "Engineer", company: "Acme" }

    it("a read-only grant cannot call add_application or add_applications, and nothing is added", async () => {
      authenticateOAuthAccessToken.mockResolvedValue(grant(["applications:read"]))
      for (const [name, args] of [["add_application", job], ["add_applications", { jobs: [job] }]] as const) {
        const body = await (await POST(rpc(callTool(name, args), { authorization: "Bearer jat_ok" }))).json()
        expect(body.result?.isError ?? Boolean(body.error)).toBe(true)
      }
      expect(addApplication).not.toHaveBeenCalled()
    })

    it("a write grant can call add_application, bound to the grant's user", async () => {
      authenticateOAuthAccessToken.mockResolvedValue(grant(["applications:read", "applications:write"]))
      await POST(rpc(callTool("add_application", job), { authorization: "Bearer jat_ok" }))
      expect(addApplication).toHaveBeenCalledWith("user-a", expect.objectContaining(job))
    })

    it("a read-only grant can still read, bound to the grant's user", async () => {
      authenticateOAuthAccessToken.mockResolvedValue(grant(["applications:read"]))
      const response = await POST(rpc(callTool("list_applications", { limit: 3 }), { authorization: "Bearer jat_ok" }))
      expect(response.status).toBe(200)
      expect(listApplications).toHaveBeenCalledWith("user-a", expect.objectContaining({ limit: 3 }))
    })

    it("a write grant lists and can call the write tools", async () => {
      authenticateOAuthAccessToken.mockResolvedValue(grant(["applications:read", "applications:write"]))
      const headers = { authorization: "Bearer jat_ok" }
      expect(await toolNames(headers)).toEqual([
        "add_application", "add_applications", "add_note", "check_job_exists", "complete_follow_up", "get_application", "get_application_activity",
        "get_company_research", "get_credits", "get_job_preferences", "get_pipeline_summary", "list_applications", "list_cvs", "list_due",
        "list_stale_applications", "list_upcoming_deadlines", "list_upcoming_interviews", "set_follow_up", "set_interview_time", "snooze_follow_up",
        "undo_last_change", "update_application_details", "update_application_status", "update_application_statuses",
      ])
      await POST(rpc(callTool("set_follow_up", { application_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", note: "x" }), headers))
      expect(setFollowUp).toHaveBeenCalledWith("user-a", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", expect.objectContaining({ note: "x" }))
    })

    it("a grant for another resource is not valid here", async () => {
      authenticateOAuthAccessToken.mockResolvedValue(grant(["applications:read"], "https://other.example/api/mcp"))
      expect((await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: "Bearer jat_ok" }))).status).toBe(401)
    })

    it("never consults the jc_ lookup for an OAuth token, nor the OAuth lookup for a jc_ token", async () => {
      authenticateOAuthAccessToken.mockResolvedValue(grant(["applications:read"]))
      await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: "Bearer jat_ok" }))
      expect(authenticateApiToken).not.toHaveBeenCalled()
      authenticateApiToken.mockResolvedValue(FULL_TOKEN)
      await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: "Bearer jc_ok" }))
      expect(authenticateOAuthAccessToken).toHaveBeenCalledTimes(1)
    })
  })

  it("rate limits repeated authentication failures per IP", async () => {
    mcpAuthFailureLimit.limit.mockResolvedValue({ success: false })
    const response = await POST(rpc({}, { authorization: "Bearer jc_x", "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))
    expect(response.status).toBe(429)
    expect(mcpAuthFailureLimit.limit).toHaveBeenCalledWith("203.0.113.9")
  })

  it("rate limits an authenticated user", async () => {
    authenticateApiToken.mockResolvedValue(FULL_TOKEN)
    mcpRateLimit.limit.mockResolvedValue({ success: false })
    const response = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: "Bearer jc_ok" }))
    expect(response.status).toBe(429)
    expect(mcpRateLimit.limit).toHaveBeenCalledWith("user-a")
  })

  it("lists exactly the intended tools, with no delete or billing tools", async () => {
    authenticateApiToken.mockResolvedValue(FULL_TOKEN)
    const response = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: "Bearer jc_ok" }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual([
      "add_application",
      "add_applications",
      "add_note",
      "check_job_exists",
      "complete_follow_up",
      "get_application",
      "get_application_activity",
      "get_company_research",
      "get_credits",
      "get_job_preferences",
      "get_pipeline_summary",
      "list_applications",
      "list_cvs",
      "list_due",
      "list_stale_applications",
      "list_upcoming_deadlines",
      "list_upcoming_interviews",
      "set_follow_up",
      "set_interview_time",
      "snooze_follow_up",
      "undo_last_change",
      "update_application_details",
      "update_application_status",
      "update_application_statuses",
    ])
  })

  it("binds tools to the authenticated token's user, never to a user id from the request", async () => {
    authenticateApiToken.mockResolvedValue(FULL_TOKEN)
    const response = await POST(rpc(callTool("list_applications", { user_id: "user-b", limit: 5 }), { authorization: "Bearer jc_ok" }))
    expect(response.status).toBe(200)
    expect(listApplications).toHaveBeenCalledWith("user-a", expect.objectContaining({ limit: 5 }))
    expect(JSON.stringify(listApplications.mock.calls)).not.toContain("user-b")
  })

  it("rejects invalid arguments (bad status, naive timestamp, bad id) before touching the database", async () => {
    authenticateApiToken.mockResolvedValue(FULL_TOKEN)
    const headers = { authorization: "Bearer jc_ok" }
    for (const [name, args] of [
      ["list_applications", { status: "deleted" }],
      ["set_interview_time", { application_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", interview_at: "2026-12-01T14:30:00" }],
      ["get_application", { application_id: "not-a-uuid" }],
    ] as const) {
      const body = await (await POST(rpc(callTool(name, args), headers))).json()
      expect(body.result?.isError ?? Boolean(body.error)).toBe(true)
    }
    expect(listApplications).not.toHaveBeenCalled()
  })

  describe("manual tokens (jc_)", () => {
    const toolNames = async (headers: Record<string, string>) =>
      ((await (await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, headers))).json()).result.tools as { name: string }[]).map((tool) => tool.name).sort()
    const headers = { authorization: "Bearer jc_ok" }
    const job = { url: "https://example.com/jobs/1", title: "Engineer", company: "Acme" }

    it("a read-only token lists only the read tools", async () => {
      authenticateApiToken.mockResolvedValue(READ_TOKEN)
      expect(await toolNames(headers)).toEqual(["check_job_exists", "get_application", "get_job_preferences", "list_applications", "list_due"])
    })

    it("a read-only token cannot call any write tool, and nothing is written", async () => {
      authenticateApiToken.mockResolvedValue(READ_TOKEN)
      const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
      for (const [name, args] of [
        ["set_follow_up", { application_id: id, note: "x" }],
        ["set_interview_time", { application_id: id, interview_at: null }],
        ["add_note", { application_id: id, note: "x" }],
        ["update_application_status", { application_id: id, status: "applied" }],
        ["add_application", job],
        ["add_applications", { jobs: [job] }],
      ] as const) {
        const body = await (await POST(rpc(callTool(name, args), headers))).json()
        expect(body.result?.isError ?? Boolean(body.error), name).toBe(true)
      }
      expect(setFollowUp).not.toHaveBeenCalled()
      expect(addApplication).not.toHaveBeenCalled()
    })

    it("a read-only token can still read, bound to its owner", async () => {
      authenticateApiToken.mockResolvedValue(READ_TOKEN)
      expect((await POST(rpc(callTool("list_applications", { limit: 3 }), headers))).status).toBe(200)
      expect(listApplications).toHaveBeenCalledWith("user-a", expect.objectContaining({ limit: 3 }))
    })

    it("a read + changes token can call write tools", async () => {
      authenticateApiToken.mockResolvedValue(FULL_TOKEN)
      await POST(rpc(callTool("add_application", job), headers))
      expect(addApplication).toHaveBeenCalledWith("user-a", expect.objectContaining(job))
    })

    it("an expired token gets a 401 that says it expired, when, and what to do", async () => {
      authenticateApiToken.mockResolvedValue({ expired: true, expiredAt: new Date("2026-11-01T09:30:00.000Z") })
      const response = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, headers))
      expect(response.status).toBe(401)
      const { error } = await response.json()
      expect(error).toContain("expired on 2026-11-01")
      expect(error).toContain("Settings -> AI Agent")
      const challenge = response.headers.get("www-authenticate") ?? ""
      expect(challenge).toContain('error="invalid_token"')
      expect(challenge).toContain("expired")
      expect(listApplications).not.toHaveBeenCalled()
    })

    it("a token with no expiry keeps working (authenticate just returns it)", async () => {
      authenticateApiToken.mockResolvedValue(FULL_TOKEN)
      expect((await POST(rpc(callTool("list_applications", {}), headers))).status).toBe(200)
    })

    it("an unknown token is invalid, not expired", async () => {
      const { error } = await (await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, headers))).json()
      expect(error).toBe("Invalid or revoked token.")
    })
  })

  describe("the connection making the request", () => {
    it("is known to the tools: a token's id and daily limit", async () => {
      authenticateApiToken.mockResolvedValue({ ...FULL_TOKEN, tokenId: "tok-9", dailyCreateCap: 7 })
      let seen: unknown
      addApplication.mockImplementation(async () => {
        seen = currentConnection()
        return { data: { created: true } }
      })
      await POST(rpc(callTool("add_application", { url: "https://example.com/jobs/1", title: "Engineer", company: "Acme" }), { authorization: "Bearer jc_ok" }))
      expect(seen).toEqual({ kind: "token", id: "tok-9", dailyCreateCap: 7 })
    })

    it("is known to the tools: a connected app's grant id and daily limit", async () => {
      authenticateOAuthAccessToken.mockResolvedValue({ userId: "user-a", scopes: ["applications:read", "applications:write"], grantId: "grant-3", resource: "https://jobclock.dev/api/mcp", dailyCreateCap: 0 })
      let seen: unknown
      addApplication.mockImplementation(async () => {
        seen = currentConnection()
        return { data: { created: true } }
      })
      await POST(rpc(callTool("add_application", { url: "https://example.com/jobs/1", title: "Engineer", company: "Acme" }), { authorization: "Bearer jat_ok" }))
      expect(seen).toEqual({ kind: "oauth", id: "grant-3", dailyCreateCap: 0 })
    })

    it("does not leak into the next request", async () => {
      authenticateApiToken.mockResolvedValue(FULL_TOKEN)
      await POST(rpc(callTool("list_applications", {}), { authorization: "Bearer jc_ok" }))
      expect(currentConnection()).toBeUndefined()
    })
  })

  describe("limit errors say what the limit is, why, and how to change it", () => {
    it("rate limit: names 120 a minute, why, and that it is fixed", async () => {
      authenticateApiToken.mockResolvedValue(FULL_TOKEN)
      mcpRateLimit.limit.mockResolvedValue({ success: false })
      const response = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: "Bearer jc_ok" }))
      expect(response.status).toBe(429)
      expect(response.headers.get("retry-after")).toBe("60")
      const { error } = await response.json()
      expect(error).toContain("120 requests in a minute")
      expect(error).toContain("runaway agent loop")
      expect(error).toContain("src/lib/mcp/limits.ts")
    })

    it("failed sign-ins: names 20 a minute per IP and why", async () => {
      mcpAuthFailureLimit.limit.mockResolvedValue({ success: false })
      const { error } = await (await POST(rpc({}, { authorization: "Bearer jc_x" }))).json()
      expect(error).toContain("20 failed sign-ins per minute")
      expect(error).toContain("token guessing")
      expect(error).toContain("docs/mcp-agent-access.md")
    })

    it("request size: names the size and why, and allows a full batch of 20 long descriptions", async () => {
      authenticateApiToken.mockResolvedValue(FULL_TOKEN)
      const big = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: "Bearer jc_ok", "content-length": "1000001" }))
      expect(big.status).toBe(413)
      const { error } = await big.json()
      expect(error).toContain("1 MB per request")
      expect(error).toContain("largest legitimate batch")
      const fine = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: "Bearer jc_ok", "content-length": "450000" }))
      expect(fine.status).toBe(200)
    })

    it("a batch over 20 jobs reaches the tool, which explains the limit (the schema does not cut it off with a generic message)", async () => {
      authenticateApiToken.mockResolvedValue(FULL_TOKEN)
      const jobs = Array.from({ length: 21 }, (_, i) => ({ url: `https://example.com/${i}`, title: "t", company: "c" }))
      const body = await (await POST(rpc(callTool("add_applications", { jobs }), { authorization: "Bearer jc_ok" }))).json()
      const text = JSON.stringify(body)
      expect(text).not.toMatch(/Too big: expected array/)
      expect(text).toContain("21 sent, at most 20 allowed")
    })

    it("a too-long field is rejected with the limit, the reason and that it is fixed", async () => {
      authenticateApiToken.mockResolvedValue(FULL_TOKEN)
      const body = await (await POST(rpc(callTool("add_application", { url: "https://example.com/jobs/1", title: "t".repeat(201), company: "Acme" }), { authorization: "Bearer jc_ok" }))).json()
      const text = JSON.stringify(body)
      expect(text).toContain("title is longer than the 200-character limit")
      expect(text).toContain("bloat")
      expect(text).toContain("fixed")
      expect(addApplication).not.toHaveBeenCalled()
    })
  })

  it("does not offer GET or DELETE", async () => {
    expect((await GET()).status).toBe(405)
    expect((await DELETE()).status).toBe(405)
  })
})
