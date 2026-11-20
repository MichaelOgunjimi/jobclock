import { exchangeAuthorizationCode, refreshAccessToken } from "@/lib/oauth/tokens"
import { clientIp, oauthError, oauthJson, preflight, readLimitedText } from "@/lib/oauth/http"
import { OAUTH_TOKEN_BODY_BYTES, OAUTH_TOKEN_REQUESTS_PER_MINUTE } from "@/lib/mcp/limits"
import { oauthTokenLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_BODY_BYTES = OAUTH_TOKEN_BODY_BYTES

/** RFC 6749 token endpoint for public clients: authorization_code (with PKCE) and refresh_token (rotating). */
export async function POST(request: Request) {
  if (!(await oauthTokenLimit.limit(clientIp(request))).success) return oauthError(429, "too_many_requests", `Too many requests: at most ${OAUTH_TOKEN_REQUESTS_PER_MINUTE} per minute per IP address, to stop guessing of codes and tokens. Try again in a minute. This is a fixed server limit; see the Limits table in docs/mcp-agent-access.md.`, { "Retry-After": "60" })
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) return oauthError(400, "invalid_request", "Send application/x-www-form-urlencoded.")
  const text = await readLimitedText(request, MAX_BODY_BYTES)
  if (text === null) return oauthError(413, "invalid_request", `Request too large: token requests are limited to ${MAX_BODY_BYTES} bytes. This is a fixed server limit; see docs/mcp-agent-access.md.`)

  const form = new URLSearchParams(text)
  const clientId = form.get("client_id") ?? ""
  if (!clientId) return oauthError(401, "invalid_client", "client_id is required.")

  const grantType = form.get("grant_type")
  let result
  if (grantType === "authorization_code") {
    const code = form.get("code")
    const redirectUri = form.get("redirect_uri")
    const codeVerifier = form.get("code_verifier")
    if (!code || !redirectUri || !codeVerifier) return oauthError(400, "invalid_request", "code, redirect_uri and code_verifier are required.")
    result = await exchangeAuthorizationCode({ code, clientId, redirectUri, codeVerifier, resource: form.get("resource") ?? undefined })
  } else if (grantType === "refresh_token") {
    const refreshToken = form.get("refresh_token")
    if (!refreshToken) return oauthError(400, "invalid_request", "refresh_token is required.")
    result = await refreshAccessToken({ refreshToken, clientId })
  } else {
    return oauthError(400, "unsupported_grant_type", "Supported grant types: authorization_code, refresh_token.")
  }

  if (!result.ok) return oauthError(result.status, result.error, result.description)
  return oauthJson(result.body)
}

export const OPTIONS = preflight
