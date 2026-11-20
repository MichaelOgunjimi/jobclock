import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { createMcpServer } from "@/lib/mcp/server"
import { authenticateApiToken } from "@/lib/mcp/tokens"
import { mcpAuthFailureLimit, mcpRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 100_000

function json(body: unknown, status: number, headers?: Record<string, string>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

/** The owner's AI agent: a stateless MCP server over Streamable HTTP, authenticated by `Authorization: Bearer jc_...`. */
export async function POST(request: Request) {
  const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]
  const auth = bearer ? await authenticateApiToken(bearer) : null

  if (!auth) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    if (!(await mcpAuthFailureLimit.limit(ip)).success) return json({ error: "Too many failed attempts" }, 429, { "Retry-After": "60" })
    return json({ error: "Invalid or revoked token" }, 401, { "WWW-Authenticate": 'Bearer realm="jobclock"' })
  }

  if (!(await mcpRateLimit.limit(auth.userId)).success) return json({ error: "Rate limit exceeded" }, 429, { "Retry-After": "60" })
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413)

  const server = createMcpServer(auth.userId)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try {
    return await transport.handleRequest(request)
  } finally {
    await server.close()
  }
}

// Stateless server: no SSE stream to open and no session to end.
const methodNotAllowed = () => json({ error: "Method not allowed" }, 405, { Allow: "POST" })
export const GET = methodNotAllowed
export const DELETE = methodNotAllowed
