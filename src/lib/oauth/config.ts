import { getAppUrl } from "@/lib/site"

/** The only resource this authorization server issues tokens for. */
export const MCP_RESOURCE_PATH = "/api/mcp"

export const SCOPE_READ = "applications:read"
export const SCOPE_WRITE = "applications:write"
export const SUPPORTED_SCOPES = [SCOPE_READ, SCOPE_WRITE] as const
export type OAuthScope = (typeof SUPPORTED_SCOPES)[number]

export const AUTHORIZATION_CODE_TTL_MS = 60_000
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60
/** Sliding: every refresh issues a new refresh token that lives this long. */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

export const ACCESS_TOKEN_PREFIX = "jat_"
export const REFRESH_TOKEN_PREFIX = "jrt_"

export const MAX_CLIENT_NAME_LENGTH = 100
export const MAX_REDIRECT_URIS = 5
export const MAX_REDIRECT_URI_LENGTH = 2000
export const MAX_REGISTRATION_BODY_BYTES = 10_000
export const MAX_STATE_LENGTH = 1000

/** Everything is derived from the app's configured public origin (NEXT_PUBLIC_APP_URL), so a self-hosted deployment needs no code change. */
export const getIssuer = () => getAppUrl()
export const getMcpResourceUrl = () => `${getAppUrl()}${MCP_RESOURCE_PATH}`
export const getProtectedResourceMetadataUrl = () => `${getAppUrl()}/.well-known/oauth-protected-resource${MCP_RESOURCE_PATH}`

export function protectedResourceMetadata() {
  return {
    resource: getMcpResourceUrl(),
    authorization_servers: [getIssuer()],
    scopes_supported: [...SUPPORTED_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "JobClock",
  }
}

export function authorizationServerMetadata() {
  const issuer = getIssuer()
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
    scopes_supported: [...SUPPORTED_SCOPES],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    revocation_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    authorization_response_iss_parameter_supported: true,
  }
}

/** Accepts the canonical MCP resource URL (a trailing slash is tolerated); anything else is not a resource we protect. */
export function isMcpResource(value: string): boolean {
  return value.replace(/\/+$/, "") === getMcpResourceUrl()
}

export function parseScopes(value: string | null | undefined): OAuthScope[] {
  const requested = new Set((value ?? "").split(/\s+/).filter(Boolean))
  return SUPPORTED_SCOPES.filter((scope) => requested.has(scope))
}
