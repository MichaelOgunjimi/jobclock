import { beforeEach, describe, expect, it, vi } from "vitest"

const { authenticateApiToken, mcpRateLimit, mcpAuthFailureLimit, listApplications } = vi.hoisted(() => ({
  authenticateApiToken: vi.fn(),
  mcpRateLimit: { limit: vi.fn() },
  mcpAuthFailureLimit: { limit: vi.fn() },
  listApplications: vi.fn(),
}))

vi.mock("@/lib/mcp/tokens", () => ({ authenticateApiToken }))
vi.mock("@/lib/rate-limit", () => ({ mcpRateLimit, mcpAuthFailureLimit }))
vi.mock("@/lib/db", () => ({ db: {} }))
vi.mock("@/lib/mcp/tools", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/mcp/tools")>()), listApplications }))

import { DELETE, GET, POST } from "./route"

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
    listApplications.mockResolvedValue({ data: { count: 0, applications: [] } })
  })

  it.each([
    ["no Authorization header", {}],
    ["a non-bearer scheme", { authorization: "Basic abc" }],
    ["an empty bearer", { authorization: "Bearer " }],
    ["an unknown or revoked token", { authorization: "Bearer jc_revoked" }],
  ])("401s with %s", async (_name, headers) => {
    const response = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, headers))
    expect(response.status).toBe(401)
    expect(response.headers.get("www-authenticate")).toContain("Bearer")
    expect(listApplications).not.toHaveBeenCalled()
  })

  it("rate limits repeated authentication failures per IP", async () => {
    mcpAuthFailureLimit.limit.mockResolvedValue({ success: false })
    const response = await POST(rpc({}, { authorization: "Bearer jc_x", "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))
    expect(response.status).toBe(429)
    expect(mcpAuthFailureLimit.limit).toHaveBeenCalledWith("203.0.113.9")
  })

  it("rate limits an authenticated user", async () => {
    authenticateApiToken.mockResolvedValue({ tokenId: "t1", userId: "user-a" })
    mcpRateLimit.limit.mockResolvedValue({ success: false })
    const response = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: "Bearer jc_ok" }))
    expect(response.status).toBe(429)
    expect(mcpRateLimit.limit).toHaveBeenCalledWith("user-a")
  })

  it("lists exactly the intended tools, with no delete or billing tools", async () => {
    authenticateApiToken.mockResolvedValue({ tokenId: "t1", userId: "user-a" })
    const response = await POST(rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { authorization: "Bearer jc_ok" }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual([
      "add_note",
      "get_application",
      "list_applications",
      "list_due",
      "set_follow_up",
      "set_interview_time",
      "update_application_status",
    ])
  })

  it("binds tools to the authenticated token's user, never to a user id from the request", async () => {
    authenticateApiToken.mockResolvedValue({ tokenId: "t1", userId: "user-a" })
    const response = await POST(rpc(callTool("list_applications", { user_id: "user-b", limit: 5 }), { authorization: "Bearer jc_ok" }))
    expect(response.status).toBe(200)
    expect(listApplications).toHaveBeenCalledWith("user-a", expect.objectContaining({ limit: 5 }))
    expect(JSON.stringify(listApplications.mock.calls)).not.toContain("user-b")
  })

  it("rejects invalid arguments (bad status, naive timestamp, bad id) before touching the database", async () => {
    authenticateApiToken.mockResolvedValue({ tokenId: "t1", userId: "user-a" })
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

  it("does not offer GET or DELETE", async () => {
    expect((await GET()).status).toBe(405)
    expect((await DELETE()).status).toBe(405)
  })
})
