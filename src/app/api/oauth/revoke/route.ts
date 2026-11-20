import { revokeToken } from "@/lib/oauth/tokens"
import { clientIp, oauthError, oauthJson, preflight, readLimitedText } from "@/lib/oauth/http"
import { OAUTH_TOKEN_BODY_BYTES, OAUTH_TOKEN_REQUESTS_PER_MINUTE } from "@/lib/mcp/limits"
import { oauthTokenLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** RFC 7009. Always 200 for a well-formed request, so the response never reveals whether a token existed. */
export async function POST(request: Request) {
  if (!(await oauthTokenLimit.limit(clientIp(request))).success) return oauthError(429, "too_many_requests", `Too many requests: at most ${OAUTH_TOKEN_REQUESTS_PER_MINUTE} per minute per IP address, to stop guessing of tokens. Try again in a minute. This is a fixed server limit; see the Limits table in docs/mcp-agent-access.md.`, { "Retry-After": "60" })
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) return oauthError(400, "invalid_request", "Send application/x-www-form-urlencoded.")
  const text = await readLimitedText(request, OAUTH_TOKEN_BODY_BYTES)
  if (text === null) return oauthError(413, "invalid_request", `Request too large: revocation requests are limited to ${OAUTH_TOKEN_BODY_BYTES} bytes. This is a fixed server limit; see docs/mcp-agent-access.md.`)

  const form = new URLSearchParams(text)
  const token = form.get("token")
  const clientId = form.get("client_id")
  if (!token || !clientId) return oauthError(400, "invalid_request", "token and client_id are required.")
  await revokeToken({ token, clientId })
  return oauthJson({})
}

export const OPTIONS = preflight
