import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { runAsConnection, type McpConnection } from "@/lib/mcp/connection-context"
import { limitMessage, MCP_AUTH_FAILURES_PER_MINUTE, MCP_MAX_BODY_BYTES, MCP_REQUESTS_PER_MINUTE } from "@/lib/mcp/limits"
import { createMcpServer } from "@/lib/mcp/server"
import { authenticateApiToken } from "@/lib/mcp/tokens"
import { ACCESS_TOKEN_PREFIX, getMcpResourceUrl, getProtectedResourceMetadataUrl, SUPPORTED_SCOPES } from "@/lib/oauth/config"
import { authenticateOAuthAccessToken } from "@/lib/oauth/tokens"
import { mcpAuthFailureLimit, mcpRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function json(body: unknown, status: number, headers?: Record<string, string>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

type Auth = { userId: string; scopes: readonly string[]; connection: McpConnection }
type Failure = { message: string }

const reconnect = "Open JobClock, go to Settings -> AI Agent, and create a new token or connect the app again."

/**
 * Both credentials carry the scopes the owner chose, bound to this resource: a `jc_` token's are stored with it (tokens
 * from before the choice existed have both), a `jat_` OAuth access token carries the scopes of its grant.
 */
async function authenticate(bearer: string): Promise<Auth | Failure> {
  if (bearer.startsWith(ACCESS_TOKEN_PREFIX)) {
    const grant = await authenticateOAuthAccessToken(bearer)
    // Audience check: a grant issued for another resource (e.g. before the host changed) is not valid here.
    if (grant && grant.resource === getMcpResourceUrl()) {
      return { userId: grant.userId, scopes: grant.scopes, connection: { kind: "oauth", id: grant.grantId, dailyCreateCap: grant.dailyCreateCap, dailyDeleteCap: grant.dailyDeleteCap, dailyCreditCap: grant.dailyCreditCap } }
    }
    return { message: `Invalid, expired or revoked access token. Connected apps refresh it automatically; if this keeps happening the connection ended (it was removed, or reached the end of the period the owner chose). ${reconnect}` }
  }
  const token = await authenticateApiToken(bearer)
  if (token && "expired" in token) {
    return { message: `This token expired on ${token.expiredAt.toISOString().slice(0, 10)}. The owner chose its lifetime when creating it. ${reconnect}` }
  }
  if (token) return { userId: token.userId, scopes: token.scopes, connection: { kind: "token", id: token.tokenId, dailyCreateCap: token.dailyCreateCap, dailyDeleteCap: token.dailyDeleteCap, dailyCreditCap: token.dailyCreditCap } }
  return { message: "Invalid or revoked token." }
}

/** RFC 9728: points OAuth clients at the protected resource metadata. Without a credential there is no `error`; with a bad one it is invalid_token. */
function challenge(hadCredential: boolean, description?: string) {
  const error = hadCredential ? `, error="invalid_token"${description ? `, error_description="${description.replace(/"/g, "'")}"` : ""}` : ""
  return `Bearer realm="jobclock"${error}, resource_metadata="${getProtectedResourceMetadataUrl()}", scope="${SUPPORTED_SCOPES.join(" ")}"`
}

/** The owner's AI agent: a stateless MCP server over Streamable HTTP, authenticated by a `jc_` token or an OAuth access token. */
export async function POST(request: Request) {
  const bearer = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]
  const auth = bearer ? await authenticate(bearer) : { message: "Authentication required: send a JobClock token or connect the app with OAuth." }

  if ("message" in auth) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    if (!(await mcpAuthFailureLimit.limit(ip)).success) {
      return json({ error: limitMessage(`Too many failed attempts: more than ${MCP_AUTH_FAILURES_PER_MINUTE} failed sign-ins per minute from this IP address`, "This protects the public endpoint from token guessing. Wait a minute, and fix the token the client is sending.") }, 429, { "Retry-After": "60" })
    }
    return json({ error: auth.message }, 401, { "WWW-Authenticate": challenge(Boolean(bearer), bearer ? auth.message : undefined) })
  }

  if (!(await mcpRateLimit.limit(auth.userId)).success) {
    return json({ error: limitMessage(`Rate limit exceeded: more than ${MCP_REQUESTS_PER_MINUTE} requests in a minute on this account`, "It stops a runaway agent loop from hammering the database. Wait a minute and slow down; one add_applications call can add up to 20 jobs.") }, 429, { "Retry-After": "60" })
  }
  if (Number(request.headers.get("content-length") ?? 0) > MCP_MAX_BODY_BYTES) {
    return json({ error: limitMessage(`Request too large: the limit is ${MCP_MAX_BODY_BYTES / 1_000_000} MB per request`, "It is sized for the largest legitimate batch. Send fewer jobs or shorter descriptions per call.") }, 413)
  }

  const server = createMcpServer(auth.userId, auth.scopes)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try {
    return await runAsConnection(auth.connection, () => transport.handleRequest(request))
  } finally {
    await server.close()
  }
}

// Stateless server: no SSE stream to open and no session to end.
const methodNotAllowed = () => json({ error: "Method not allowed" }, 405, { Allow: "POST" })
export const GET = methodNotAllowed
export const DELETE = methodNotAllowed
