import { MAX_REGISTRATION_BODY_BYTES } from "@/lib/oauth/config"
import { OAUTH_REGISTRATIONS_PER_MINUTE } from "@/lib/mcp/limits"
import { registerClient } from "@/lib/oauth/clients"
import { clientIp, oauthError, oauthJson, preflight, readLimitedText } from "@/lib/oauth/http"
import { oauthRegisterLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** RFC 7591 Dynamic Client Registration for public clients (PKCE, no client secret). */
export async function POST(request: Request) {
  if (!(await oauthRegisterLimit.limit(clientIp(request))).success) return oauthError(429, "too_many_requests", `Too many registrations: at most ${OAUTH_REGISTRATIONS_PER_MINUTE} per minute per IP address, because anyone can register and each one writes a row. Try again in a minute. This is a fixed server limit; see the Limits table in docs/mcp-agent-access.md.`, { "Retry-After": "60" })
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return oauthError(400, "invalid_client_metadata", "Send application/json.")

  const text = await readLimitedText(request, MAX_REGISTRATION_BODY_BYTES)
  if (text === null) return oauthError(413, "invalid_client_metadata", `Request too large: registration bodies are limited to ${MAX_REGISTRATION_BODY_BYTES} bytes because this endpoint needs no sign-in. Send less metadata (fixed server limit, see docs/mcp-agent-access.md).`)
  let metadata: unknown
  try {
    metadata = JSON.parse(text)
  } catch {
    return oauthError(400, "invalid_client_metadata", "Body is not valid JSON.")
  }

  const result = await registerClient(metadata)
  if ("error" in result) return oauthError(400, result.error, result.description)
  const { client } = result
  return oauthJson(
    {
      client_id: client.client_id,
      client_id_issued_at: client.created_at,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201,
  )
}

export const OPTIONS = preflight
