import { sql } from "drizzle-orm"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js"
import type { OAuthClientInformationMixed, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { currentUser, mcpRateLimit, mcpAuthFailureLimit, oauthRegisterLimit, oauthTokenLimit, listApplications } = vi.hoisted(() => ({
  currentUser: { id: null as string | null },
  mcpRateLimit: { limit: vi.fn() },
  mcpAuthFailureLimit: { limit: vi.fn() },
  oauthRegisterLimit: { limit: vi.fn() },
  oauthTokenLimit: { limit: vi.fn() },
  listApplications: vi.fn(),
}))

vi.mock("@/lib/db", async () => ({ db: await (await import("@/lib/oauth/test-db")).createOAuthTestDb() }))
vi.mock("@/lib/rate-limit", () => ({ mcpRateLimit, mcpAuthFailureLimit, oauthRegisterLimit, oauthTokenLimit }))
vi.mock("@/lib/mcp/tools", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/mcp/tools")>()), listApplications }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: currentUser.id ? { id: currentUser.id } : null } }) } }) }))
// Next's redirect() throws; surface the target so the test can follow it like a browser would.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectUrl: url })
  },
}))

import { db } from "@/lib/db"
import { oauthAuthorizationCodes, oauthClients } from "@/lib/db/schema"
import { decideConsent } from "@/app/oauth/authorize/actions"
import { GET as authorizationServerMetadata } from "@/app/.well-known/oauth-authorization-server/route"
import { GET as protectedResourceMetadata } from "@/app/.well-known/oauth-protected-resource/api/mcp/route"
import { POST as mcp } from "@/app/api/mcp/route"
import { POST as register } from "./register/route"
import { POST as revoke } from "./revoke/route"
import { POST as token } from "./token/route"

const USER_A = "11111111-1111-4111-8111-111111111111"
const USER_B = "22222222-2222-4222-8222-222222222222"
const ORIGIN = "https://jobclock.dev"

const routes: Record<string, (request: Request) => Response | Promise<Response>> = {
  "/.well-known/oauth-protected-resource/api/mcp": protectedResourceMetadata,
  "/.well-known/oauth-authorization-server": authorizationServerMetadata,
  "/api/oauth/register": register,
  "/api/oauth/token": token,
  "/api/oauth/revoke": revoke,
  "/api/mcp": mcp,
}

/** A network that only knows this app: every URL the SDK client builds from discovery is served by the real route handlers. */
const appFetch = async (input: string | URL | Request, init?: RequestInit) => {
  const request = new Request(input, init)
  const handler = routes[new URL(request.url).pathname]
  if (!handler) return new Response("not found", { status: 404 })
  return handler(request)
}

/** What a real MCP client (Claude) does: keeps its registration, tokens and PKCE verifier, and hands the authorization URL to a browser. */
class TestProvider implements OAuthClientProvider {
  info?: OAuthClientInformationMixed
  saved?: OAuthTokens
  verifier = ""
  authorizationUrl?: URL
  constructor(private callback = "https://claude.ai/api/mcp/auth_callback") {}
  get redirectUrl() { return this.callback }
  get clientMetadata() { return { client_name: "Claude", redirect_uris: [this.callback], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] } }
  clientInformation() { return this.info }
  saveClientInformation(info: OAuthClientInformationMixed) { this.info = info }
  tokens() { return this.saved }
  saveTokens(tokens: OAuthTokens) { this.saved = tokens }
  redirectToAuthorization(url: URL) { this.authorizationUrl = url }
  saveCodeVerifier(verifier: string) { this.verifier = verifier }
  codeVerifier() { return this.verifier }
  state() { return "client-state-123" }
}

/** The browser leg: open the authorization URL's consent screen as the signed-in user and press a button. */
async function userDecides(provider: TestProvider, { write, decision = "allow" }: { write: boolean; decision?: string }) {
  const form = new FormData()
  for (const [name, value] of provider.authorizationUrl!.searchParams) form.set(name, value)
  form.set("decision", decision)
  if (write) form.set("write", "on")
  const error = await decideConsent(form).then(() => null, (thrown) => thrown as { redirectUrl: string })
  return new URL(error!.redirectUrl)
}

async function connectWithOAuth({ write, userId = USER_A }: { write: boolean; userId?: string }) {
  currentUser.id = userId
  const provider = new TestProvider()
  const first = new StreamableHTTPClientTransport(new URL(`${ORIGIN}/api/mcp`), { authProvider: provider, fetch: appFetch })
  // No token: the server must answer 401 + resource_metadata, which sends the SDK through discovery, registration and the authorize redirect.
  await expect(new Client({ name: "test", version: "1" }).connect(first)).rejects.toThrow()
  expect(provider.authorizationUrl).toBeDefined()
  const redirect = await userDecides(provider, { write })
  expect(redirect.searchParams.get("state")).toBe("client-state-123")
  expect(redirect.searchParams.get("iss")).toBe(ORIGIN)
  await first.finishAuth(redirect.searchParams.get("code")!)

  const client = new Client({ name: "test", version: "1" })
  await client.connect(new StreamableHTTPClientTransport(new URL(`${ORIGIN}/api/mcp`), { authProvider: provider, fetch: appFetch }))
  return { client, provider }
}

const formBody = (fields: Record<string, string>) => ({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) })

beforeEach(async () => {
  vi.clearAllMocks()
  currentUser.id = null
  for (const limiter of [mcpRateLimit, mcpAuthFailureLimit, oauthRegisterLimit, oauthTokenLimit]) limiter.limit.mockResolvedValue({ success: true })
  listApplications.mockResolvedValue({ data: { count: 0, applications: [] } })
  await db.execute(sql`TRUNCATE oauth_clients, oauth_grants, oauth_authorization_codes, oauth_tokens, profiles CASCADE`)
  await db.execute(sql`INSERT INTO profiles (id) VALUES (${USER_A}), (${USER_B})`)
})

describe("discovery", () => {
  it("serves protected resource metadata (RFC 9728) derived from the configured origin", async () => {
    const response = await protectedResourceMetadata()
    expect(await response.json()).toEqual({
      resource: `${ORIGIN}/api/mcp`,
      authorization_servers: [ORIGIN],
      scopes_supported: ["applications:read", "applications:write"],
      bearer_methods_supported: ["header"],
      resource_name: "JobClock",
    })
  })

  it("serves authorization server metadata (RFC 8414) that requires PKCE S256 and public clients", async () => {
    const metadata = await (await authorizationServerMetadata()).json()
    expect(metadata).toMatchObject({
      issuer: ORIGIN,
      authorization_endpoint: `${ORIGIN}/oauth/authorize`,
      token_endpoint: `${ORIGIN}/api/oauth/token`,
      registration_endpoint: `${ORIGIN}/api/oauth/register`,
      revocation_endpoint: `${ORIGIN}/api/oauth/revoke`,
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      grant_types_supported: ["authorization_code", "refresh_token"],
    })
  })
})

describe("the whole flow with the MCP SDK's own OAuth client", () => {
  it("connects with no token, read-only by default: sees read tools, cannot see or call write tools", async () => {
    const { client } = await connectWithOAuth({ write: false })
    const names = (await client.listTools()).tools.map((tool) => tool.name).sort()
    expect(names).toEqual(["check_job_exists", "get_application", "get_job_preferences", "list_applications", "list_due"])

    const result = await client.callTool({ name: "list_applications", arguments: { limit: 2 } })
    expect(result.isError).toBeFalsy()
    expect(listApplications).toHaveBeenCalledWith(USER_A, expect.objectContaining({ limit: 2 }))

    await expect(client.callTool({ name: "add_note", arguments: { application_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", note: "hi" } })).resolves.toMatchObject({ isError: true })
  })

  it("with write ticked, the client also sees the write tools", async () => {
    const { client } = await connectWithOAuth({ write: true })
    expect((await client.listTools()).tools).toHaveLength(11)
  })

  it("a grant for user A only ever acts as user A", async () => {
    const a = await connectWithOAuth({ write: false, userId: USER_A })
    const b = await connectWithOAuth({ write: false, userId: USER_B })
    await a.client.callTool({ name: "list_applications", arguments: {} })
    await b.client.callTool({ name: "list_applications", arguments: {} })
    expect(listApplications.mock.calls.map((call) => call[0])).toEqual([USER_A, USER_B])
  })

  it("refreshes through the token endpoint when the access token is rejected, and the old refresh token then trips reuse detection", async () => {
    const { provider } = await connectWithOAuth({ write: false })
    const oldRefresh = provider.saved!.refresh_token!
    const rotated = await token(new Request(`${ORIGIN}/api/oauth/token`, formBody({ grant_type: "refresh_token", refresh_token: oldRefresh, client_id: provider.info!.client_id })))
    expect(rotated.status).toBe(200)
    expect(rotated.headers.get("cache-control")).toBe("no-store")
    const replay = await token(new Request(`${ORIGIN}/api/oauth/token`, formBody({ grant_type: "refresh_token", refresh_token: oldRefresh, client_id: provider.info!.client_id })))
    expect(replay.status).toBe(400)
    expect(await replay.json()).toMatchObject({ error: "invalid_grant" })
    const { access_token } = await rotated.json()
    const rejected = await mcp(new Request(`${ORIGIN}/api/mcp`, { method: "POST", headers: { authorization: `Bearer ${access_token}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }))
    expect(rejected.status).toBe(401)
  })

  it("denying sends access_denied (with state) to the registered redirect and issues nothing", async () => {
    currentUser.id = USER_A
    const provider = new TestProvider()
    await expect(new Client({ name: "t", version: "1" }).connect(new StreamableHTTPClientTransport(new URL(`${ORIGIN}/api/mcp`), { authProvider: provider, fetch: appFetch }))).rejects.toThrow()
    const redirect = await userDecides(provider, { write: true, decision: "deny" })
    expect(`${redirect.origin}${redirect.pathname}`).toBe("https://claude.ai/api/mcp/auth_callback")
    expect(redirect.searchParams.get("error")).toBe("access_denied")
    expect(redirect.searchParams.get("state")).toBe("client-state-123")
    expect(redirect.searchParams.has("code")).toBe(false)
    expect(await db.select().from(oauthAuthorizationCodes)).toHaveLength(0)
  })

  it("the consent action re-validates: a tampered redirect_uri is never redirected to, and no code is issued", async () => {
    currentUser.id = USER_A
    const provider = new TestProvider()
    await expect(new Client({ name: "t", version: "1" }).connect(new StreamableHTTPClientTransport(new URL(`${ORIGIN}/api/mcp`), { authProvider: provider, fetch: appFetch }))).rejects.toThrow()
    const form = new FormData()
    for (const [name, value] of provider.authorizationUrl!.searchParams) form.set(name, value)
    form.set("redirect_uri", "https://evil.example/steal")
    form.set("decision", "allow")
    const thrown = (await decideConsent(form).then(() => null, (error) => error)) as { redirectUrl: string }
    expect(thrown.redirectUrl).toBe("/oauth/authorize")
    expect(await db.select().from(oauthAuthorizationCodes)).toHaveLength(0)
  })

  it("the consent action will not issue a code without a signed-in user", async () => {
    const provider = new TestProvider()
    await expect(new Client({ name: "t", version: "1" }).connect(new StreamableHTTPClientTransport(new URL(`${ORIGIN}/api/mcp`), { authProvider: provider, fetch: appFetch }))).rejects.toThrow()
    currentUser.id = null
    const redirect = await decideConsent(Object.assign(new FormData(), {})).then(() => null, (error) => error as { redirectUrl: string })
    expect(redirect?.redirectUrl).toBe("/oauth/authorize")
    const form = new FormData()
    for (const [name, value] of provider.authorizationUrl!.searchParams) form.set(name, value)
    form.set("decision", "allow")
    expect(((await decideConsent(form).then(() => null, (error) => error)) as { redirectUrl: string }).redirectUrl).toBe("/auth")
    expect(await db.select().from(oauthAuthorizationCodes)).toHaveLength(0)
  })

  it("revocation through the endpoint disconnects the client", async () => {
    const { provider } = await connectWithOAuth({ write: true })
    const response = await revoke(new Request(`${ORIGIN}/api/oauth/revoke`, formBody({ token: provider.saved!.refresh_token!, client_id: provider.info!.client_id })))
    expect(response.status).toBe(200)
    const after = await mcp(new Request(`${ORIGIN}/api/mcp`, { method: "POST", headers: { authorization: `Bearer ${provider.saved!.access_token}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) }))
    expect(after.status).toBe(401)
    expect(after.headers.get("www-authenticate")).toContain("resource_metadata=")
  })
})

describe("POST /api/oauth/register", () => {
  const post = (body: unknown, headers: Record<string, string> = { "content-type": "application/json" }) =>
    register(new Request(`${ORIGIN}/api/oauth/register`, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) }))

  it("registers a public client", async () => {
    const response = await post({ client_name: "Claude", redirect_uris: ["https://claude.ai/cb"] })
    expect(response.status).toBe(201)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toMatchObject({ client_name: "Claude", redirect_uris: ["https://claude.ai/cb"], token_endpoint_auth_method: "none" })
  })

  it.each([
    ["an http redirect on a public host", { redirect_uris: ["http://evil.example/cb"] }, "invalid_redirect_uri"],
    ["a custom scheme", { redirect_uris: ["myapp://cb"] }, "invalid_redirect_uri"],
    ["no redirect_uris", { client_name: "x" }, "invalid_client_metadata"],
    ["a confidential-client method", { redirect_uris: ["https://a.example/cb"], token_endpoint_auth_method: "client_secret_post" }, "invalid_client_metadata"],
  ])("400s for %s", async (_name, body, error) => {
    const response = await post(body)
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error })
  })

  it("rejects non-JSON, malformed and oversized bodies", async () => {
    expect((await post("{}", { "content-type": "text/plain" })).status).toBe(400)
    expect((await post("{nope")).status).toBe(400)
    expect((await post({ redirect_uris: ["https://a.example/cb"], client_name: "x", padding: "p".repeat(11_000) })).status).toBe(413)
  })

  it("is rate limited per IP and stores nothing when limited", async () => {
    oauthRegisterLimit.limit.mockResolvedValue({ success: false })
    const response = await register(new Request(`${ORIGIN}/api/oauth/register`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7, 10.0.0.1" }, body: JSON.stringify({ redirect_uris: ["https://a.example/cb"] }) }))
    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("60")
    expect(oauthRegisterLimit.limit).toHaveBeenCalledWith("203.0.113.7")
    expect(await db.select().from(oauthClients)).toHaveLength(0)
  })
})

describe("POST /api/oauth/token", () => {
  it("requires a form-encoded body, a client_id and a known grant type", async () => {
    expect((await token(new Request(`${ORIGIN}/api/oauth/token`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }))).status).toBe(400)
    expect((await token(new Request(`${ORIGIN}/api/oauth/token`, formBody({ grant_type: "authorization_code" })))).status).toBe(401)
    const unsupported = await token(new Request(`${ORIGIN}/api/oauth/token`, formBody({ grant_type: "password", client_id: "x" })))
    expect(await unsupported.json()).toMatchObject({ error: "unsupported_grant_type" })
  })

  it("is rate limited per IP", async () => {
    oauthTokenLimit.limit.mockResolvedValue({ success: false })
    expect((await token(new Request(`${ORIGIN}/api/oauth/token`, formBody({ grant_type: "refresh_token", client_id: "x", refresh_token: "y" })))).status).toBe(429)
  })

  it("never caches an error or a success", async () => {
    const response = await token(new Request(`${ORIGIN}/api/oauth/token`, formBody({ grant_type: "authorization_code", client_id: "x", code: "c", redirect_uri: "https://a.example", code_verifier: "v" })))
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("pragma")).toBe("no-cache")
  })
})

describe("POST /api/oauth/revoke", () => {
  it("answers 200 for an unknown token so existence is never revealed", async () => {
    expect((await revoke(new Request(`${ORIGIN}/api/oauth/revoke`, formBody({ token: "jat_unknown", client_id: "00000000-0000-4000-8000-000000000000" })))).status).toBe(200)
  })

  it("requires token and client_id", async () => {
    expect((await revoke(new Request(`${ORIGIN}/api/oauth/revoke`, formBody({ token: "x" })))).status).toBe(400)
  })
})
