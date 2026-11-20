import { randomBytes } from "crypto"
import { db } from "@/lib/db"
import { oauthAuthorizationCodes } from "@/lib/db/schema"
import { hashApiToken } from "@/lib/mcp/tokens"
import {
  AUTHORIZATION_CODE_TTL_MS,
  getIssuer,
  getMcpResourceUrl,
  isMcpResource,
  MAX_STATE_LENGTH,
  parseScopes,
  SCOPE_READ,
  SCOPE_WRITE,
  SUPPORTED_SCOPES,
  type OAuthScope,
} from "./config"
import { getClient, redirectUriMatches } from "./clients"
import { isValidCodeChallenge } from "./pkce"

export const AUTHORIZE_PARAMS = ["client_id", "redirect_uri", "response_type", "code_challenge", "code_challenge_method", "state", "scope", "resource"] as const

export interface AuthorizeRequest {
  clientId: string
  clientName: string
  redirectUri: string
  codeChallenge: string
  state: string | null
  resource: string
  /** What the client asked for (read is always included). The user can only narrow this. */
  offeredScopes: OAuthScope[]
}

export type AuthorizeParse =
  // The client or redirect_uri cannot be trusted: show an error page and NEVER redirect.
  | { ok: false; fatal: string }
  // The redirect_uri is registered, so the error goes back to the client (RFC 6749 4.1.2.1).
  | { ok: false; redirectUri: string; state: string | null; error: string; description: string }
  | { ok: true; request: AuthorizeRequest }

/** Used by the consent page and again by the consent action, so nothing from the form is trusted twice. */
export async function parseAuthorizeRequest(get: (name: string) => string | null | undefined): Promise<AuthorizeParse> {
  const clientId = get("client_id") ?? ""
  const redirectUri = get("redirect_uri") ?? ""
  const client = clientId ? await getClient(clientId) : null
  if (!client) return { ok: false, fatal: "This app is not registered with JobClock." }
  if (!redirectUri || !redirectUriMatches(client.redirectUris, redirectUri)) {
    return { ok: false, fatal: "This app asked to return you to an address it did not register." }
  }

  const state = get("state") ?? null
  const fail = (error: string, description: string): AuthorizeParse => ({ ok: false, redirectUri, state, error, description })

  if (state !== null && state.length > MAX_STATE_LENGTH) return fail("invalid_request", "state is too long.")
  if (get("response_type") !== "code") return fail("unsupported_response_type", "Only response_type=code is supported.")
  const challenge = get("code_challenge") ?? ""
  if (!challenge) return fail("invalid_request", "PKCE is required: send a code_challenge.")
  if (get("code_challenge_method") !== "S256") return fail("invalid_request", "PKCE method must be S256.")
  if (!isValidCodeChallenge(challenge)) return fail("invalid_request", "code_challenge is not a valid S256 challenge.")
  const resource = get("resource")
  if (resource && !isMcpResource(resource)) return fail("invalid_target", "Unknown resource.")

  const requested = parseScopes(get("scope"))
  const offeredScopes = requested.length > 0 ? [...new Set<OAuthScope>([SCOPE_READ, ...requested])] : [...SUPPORTED_SCOPES]
  return {
    ok: true,
    request: { clientId: client.id, clientName: client.clientName, redirectUri, codeChallenge: challenge, state, resource: getMcpResourceUrl(), offeredScopes },
  }
}

/** The redirect back to the client. `iss` (RFC 9207) lets the client detect a response from the wrong authorization server. */
export function buildClientRedirect(redirectUri: string, params: { code?: string; error?: string; description?: string; state: string | null }): string {
  const url = new URL(redirectUri)
  if (params.code) url.searchParams.set("code", params.code)
  if (params.error) url.searchParams.set("error", params.error)
  if (params.description) url.searchParams.set("error_description", params.description)
  if (params.state !== null) url.searchParams.set("state", params.state)
  url.searchParams.set("iss", getIssuer())
  return url.toString()
}

/** Read is always granted; write only when the user ticked it AND the client asked for it. Returns the plaintext code (never stored). */
export async function issueAuthorizationCode(userId: string, request: AuthorizeRequest, allowWrite: boolean): Promise<string> {
  const scopes: OAuthScope[] = allowWrite && request.offeredScopes.includes(SCOPE_WRITE) ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ]
  const code = randomBytes(32).toString("base64url")
  await db.insert(oauthAuthorizationCodes).values({
    codeHash: hashApiToken(code),
    userId,
    clientId: request.clientId,
    redirectUri: request.redirectUri,
    codeChallenge: request.codeChallenge,
    scopes,
    resource: request.resource,
    expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS),
  })
  return code
}
