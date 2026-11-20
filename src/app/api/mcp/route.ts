import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { createMcpServer } from "@/lib/mcp/server"
import { authenticateApiToken } from "@/lib/mcp/tokens"
import { ACCESS_TOKEN_PREFIX, getMcpResourceUrl, getProtectedResourceMetadataUrl, SCOPE_READ, SCOPE_WRITE } from "@/lib/oauth/config"
import { authenticateOAuthAccessToken } from "@/lib/oauth/tokens"
import { mcpAuthFailureLimit, mcpRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = 100_000

function json(body: unknown, status: number, headers?: Record<string, string>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

type Auth = { userId: string; scopes: readonly string[] }

/** A `jc_` token is full access, as it always was; a `jat_` OAuth access token carries the scopes the user granted, bound to this resource. */
async function authenticate(bearer: string): Promise<Auth | null> {
  if (bearer.startsWith(ACCESS_TOKEN_PREFIX)) {
    const grant = await authenticateOAuthAccessToken(bearer)
    // Audience check: a grant issued for another resource (e.g. before the host changed) is not valid here.
    return grant && grant.resource === getMcpResourceUrl() ? grant : null
  }
  const token = await authenticateApiToken(bearer)
  return token && { userId: token.userId, scopes: [SCOPE_READ, SCOPE_WRITE] }
}

/** RFC 9728: points OAuth clients at the protected resource metadata. Without a credential there is no `error`; with a bad one it is invalid_token. */
function challenge(hadCredential: boolean) {
  const error = hadCredential ? ', error="invalid_token"' : ""
  return `Bearer realm="jobclock"${error}, resource_metadata="${getProtectedResourceMetadataUrl()}", scope="${SCOPE_READ} ${SCOPE_WRITE}"`
}

/** The owner's AI agent: a stateless MCP server over Streamable HTTP, authenticated by a `jc_` token or an OAuth access token. */
export async function POST(request: Request) {
  const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]
  const auth = bearer ? await authenticate(bearer) : null

  if (!auth) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    if (!(await mcpAuthFailureLimit.limit(ip)).success) return json({ error: "Too many failed attempts" }, 429, { "Retry-After": "60" })
    return json({ error: bearer ? "Invalid, expired or revoked token" : "Authentication required" }, 401, { "WWW-Authenticate": challenge(Boolean(bearer)) })
  }

  if (!(await mcpRateLimit.limit(auth.userId)).success) return json({ error: "Rate limit exceeded" }, 429, { "Retry-After": "60" })
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413)

  const server = createMcpServer(auth.userId, auth.scopes)
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
