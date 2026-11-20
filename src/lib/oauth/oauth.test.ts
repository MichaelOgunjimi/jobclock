import { randomBytes } from "crypto"
import { sql } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", async () => ({ db: await (await import("./test-db")).createOAuthTestDb() }))

import { db } from "@/lib/db"
import { oauthAuthorizationCodes, oauthGrants, oauthTokens } from "@/lib/db/schema"
import { buildClientRedirect, issueAuthorizationCode, parseAuthorizeRequest, parseConnectionDuration } from "./authorize"
import { isAllowedRedirectUri, registerClient } from "./clients"
import { getMcpResourceUrl, SCOPE_READ, SCOPE_WRITE } from "./config"
import { s256Challenge } from "./pkce"
import {
  authenticateOAuthAccessToken,
  exchangeAuthorizationCode,
  listConnectedApps,
  pruneOAuth,
  refreshAccessToken,
  revokeConnectedApp,
  revokeToken,
  setConnectedAppDailyCap,
} from "./tokens"

const USER_A = "11111111-1111-4111-8111-111111111111"
const USER_B = "22222222-2222-4222-8222-222222222222"
const REDIRECT = "https://claude.ai/api/mcp/auth_callback"
const LOOPBACK = "http://localhost:3118/callback"
const MINUTE = 60_000

async function register(redirectUris = [REDIRECT, LOOPBACK], client_name = "Claude") {
  const result = await registerClient({ client_name, redirect_uris: redirectUris })
  if ("error" in result) throw new Error(result.description)
  return result.client
}

function authorizeParams(clientId: string, overrides: Record<string, string> = {}, verifier = randomBytes(32).toString("base64url")) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    code_challenge: s256Challenge(verifier),
    code_challenge_method: "S256",
    state: "xyz",
    resource: getMcpResourceUrl(),
    ...overrides,
  })
  return { params, verifier }
}

/** The consent step as the user would complete it: validate the request, then issue a code for `userId`. */
async function consent(userId: string, clientId: string, { write = false, scope, duration = "forever" }: { write?: boolean; scope?: string; duration?: string } = {}) {
  const { params, verifier } = authorizeParams(clientId, scope === undefined ? {} : { scope })
  const parsed = await parseAuthorizeRequest((name) => params.get(name))
  if (!parsed.ok) throw new Error(JSON.stringify(parsed))
  const period = parseConnectionDuration(duration)
  if (!period.ok) throw new Error(`bad duration ${duration}`)
  const code = await issueAuthorizationCode(userId, parsed.request, write, period.expiresAt)
  return { code, verifier, redirectUri: parsed.request.redirectUri }
}

async function connect(userId: string, clientId: string, opts: { write?: boolean; duration?: string } = {}) {
  const { code, verifier, redirectUri } = await consent(userId, clientId, opts)
  const result = await exchangeAuthorizationCode({ code, clientId, redirectUri, codeVerifier: verifier })
  if (!result.ok) throw new Error(result.description)
  return result.body
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE oauth_clients, oauth_grants, oauth_authorization_codes, oauth_tokens, profiles CASCADE`)
  await db.execute(sql`INSERT INTO profiles (id) VALUES (${USER_A}), (${USER_B})`)
})

describe("client registration", () => {
  it.each([
    ["https", "https://claude.ai/cb", true],
    ["http on localhost", "http://localhost:3000/cb", true],
    ["http on 127.0.0.1", "http://127.0.0.1:8080/cb", true],
    ["http on [::1]", "http://[::1]:8080/cb", true],
    ["http on a public host", "http://example.com/cb", false],
    ["a lookalike loopback host", "http://localhost.evil.com/cb", false],
    ["javascript:", "javascript:alert(1)", false],
    ["a custom scheme", "myapp://callback", false],
    ["a fragment", "https://claude.ai/cb#x", false],
    ["embedded credentials", "https://user:pw@claude.ai/cb", false],
    ["a relative URI", "/cb", false],
    ["an oversized URI", `https://claude.ai/${"a".repeat(2100)}`, false],
  ])("redirect URI: %s", (_name, uri, allowed) => {
    expect(isAllowedRedirectUri(uri)).toBe(allowed)
  })

  it("stores a valid public client and returns its id", async () => {
    const client = await register()
    expect(client.client_id).toMatch(/^[0-9a-f-]{36}$/)
    expect(client.redirect_uris).toEqual([REDIRECT, LOOPBACK])
  })

  it.each([
    ["no redirect_uris", {}],
    ["empty redirect_uris", { redirect_uris: [] }],
    ["too many redirect_uris", { redirect_uris: Array.from({ length: 6 }, (_, i) => `https://a.example/${i}`) }],
    ["a client secret method", { redirect_uris: [REDIRECT], token_endpoint_auth_method: "client_secret_basic" }],
    ["an unsupported grant", { redirect_uris: [REDIRECT], grant_types: ["password"] }],
    ["a name that is too long", { redirect_uris: [REDIRECT], client_name: "x".repeat(101) }],
    ["a non-object body", "nope"],
  ])("rejects %s", async (_name, body) => {
    expect("error" in (await registerClient(body))).toBe(true)
  })

  it("rejects an invalid redirect URI with invalid_redirect_uri", async () => {
    expect(await registerClient({ redirect_uris: ["http://evil.example/cb"] })).toMatchObject({ error: "invalid_redirect_uri" })
  })
})

describe("authorization request", () => {
  it("accepts a registered redirect_uri exactly and passes state through", async () => {
    const client = await register()
    const { params } = authorizeParams(client.client_id)
    const parsed = await parseAuthorizeRequest((name) => params.get(name))
    expect(parsed).toMatchObject({ ok: true, request: { redirectUri: REDIRECT, state: "xyz", resource: getMcpResourceUrl() } })
  })

  it.each([
    ["an unregistered host", "https://evil.example/cb"],
    ["a trailing slash", `${REDIRECT}/`],
    ["an added query", `${REDIRECT}?x=1`],
    ["a prefix of a registered URI", "https://claude.ai/api/mcp"],
    ["a different loopback port", "http://localhost:9999/callback"],
    ["a different case in the host", "https://CLAUDE.AI/api/mcp/auth_callback"],
    ["no redirect_uri at all", ""],
  ])("never redirects for %s (fatal page, no open redirect)", async (_name, redirectUri) => {
    const client = await register()
    const { params } = authorizeParams(client.client_id, { redirect_uri: redirectUri })
    const parsed = await parseAuthorizeRequest((name) => params.get(name))
    expect(parsed).toMatchObject({ ok: false, fatal: expect.any(String) })
    expect(parsed).not.toHaveProperty("redirectUri")
  })

  it("never redirects for an unknown or malformed client_id", async () => {
    expect(await parseAuthorizeRequest((name) => authorizeParams("00000000-0000-4000-8000-000000000000").params.get(name))).toMatchObject({ ok: false, fatal: expect.any(String) })
    expect(await parseAuthorizeRequest((name) => authorizeParams("not-a-uuid").params.get(name))).toMatchObject({ ok: false, fatal: expect.any(String) })
  })

  it.each([
    ["no PKCE", { code_challenge: "", code_challenge_method: "" }, "invalid_request"],
    ["plain PKCE", { code_challenge_method: "plain" }, "invalid_request"],
    ["no method", { code_challenge_method: "" }, "invalid_request"],
    ["a malformed challenge", { code_challenge: "tooshort" }, "invalid_request"],
    ["response_type=token", { response_type: "token" }, "unsupported_response_type"],
    ["another resource", { resource: "https://other.example/api/mcp" }, "invalid_target"],
    ["an oversized state", { state: "s".repeat(1001) }, "invalid_request"],
  ])("errors back to the registered redirect_uri for %s", async (_name, overrides, error) => {
    const client = await register()
    const { params } = authorizeParams(client.client_id, overrides)
    expect(await parseAuthorizeRequest((name) => params.get(name))).toMatchObject({ ok: false, redirectUri: REDIRECT, error })
  })

  it("offers write only when the client asked for it or asked for nothing", async () => {
    const client = await register()
    const offered = async (scope?: string) => {
      const { params } = authorizeParams(client.client_id, scope === undefined ? {} : { scope })
      const parsed = await parseAuthorizeRequest((name) => params.get(name))
      return parsed.ok ? parsed.request.offeredScopes : null
    }
    expect(await offered()).toEqual([SCOPE_READ, SCOPE_WRITE])
    expect(await offered(SCOPE_READ)).toEqual([SCOPE_READ])
    expect(await offered(`${SCOPE_READ} ${SCOPE_WRITE}`)).toEqual([SCOPE_READ, SCOPE_WRITE])
    expect(await offered("admin")).toEqual([SCOPE_READ, SCOPE_WRITE])
  })

  it("builds the client redirect with code, state and iss", () => {
    const url = new URL(buildClientRedirect(REDIRECT, { code: "c", state: "s s" }))
    expect(url.origin + url.pathname).toBe(REDIRECT)
    expect(Object.fromEntries(url.searchParams)).toEqual({ code: "c", state: "s s", iss: "https://jobclock.dev" })
  })

  it("defaults to read only: write is granted only when ticked", async () => {
    const client = await register()
    expect((await connect(USER_A, client.client_id)).scope).toBe(SCOPE_READ)
    expect((await connect(USER_A, client.client_id, { write: true })).scope).toBe(`${SCOPE_READ} ${SCOPE_WRITE}`)
  })

  it("ignores a ticked write box when the client only asked for read", async () => {
    const client = await register()
    const { code, verifier, redirectUri } = await consent(USER_A, client.client_id, { write: true, scope: SCOPE_READ })
    const result = await exchangeAuthorizationCode({ code, clientId: client.client_id, redirectUri, codeVerifier: verifier })
    expect(result).toMatchObject({ ok: true, body: { scope: SCOPE_READ } })
  })
})

describe("authorization code exchange", () => {
  it("issues short-lived opaque tokens with scope and expires_in", async () => {
    const client = await register()
    const tokens = await connect(USER_A, client.client_id, { write: true })
    expect(tokens).toMatchObject({ token_type: "Bearer", expires_in: 3600 })
    expect(tokens.access_token).toMatch(/^jat_/)
    expect(tokens.refresh_token).toMatch(/^jrt_/)
    expect(await authenticateOAuthAccessToken(tokens.access_token)).toMatchObject({ userId: USER_A, scopes: [SCOPE_READ, SCOPE_WRITE], resource: getMcpResourceUrl() })
  })

  it("is single use, and replaying a used code revokes the tokens it produced", async () => {
    const client = await register()
    const { code, verifier, redirectUri } = await consent(USER_A, client.client_id)
    const input = { code, clientId: client.client_id, redirectUri, codeVerifier: verifier }
    const first = await exchangeAuthorizationCode(input)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(await authenticateOAuthAccessToken(first.body.access_token)).not.toBeNull()

    expect(await exchangeAuthorizationCode(input)).toMatchObject({ ok: false, error: "invalid_grant" })
    expect(await authenticateOAuthAccessToken(first.body.access_token)).toBeNull()
  })

  it("lets exactly one of two concurrent exchanges win", async () => {
    const client = await register()
    const { code, verifier, redirectUri } = await consent(USER_A, client.client_id)
    const input = { code, clientId: client.client_id, redirectUri, codeVerifier: verifier }
    const results = await Promise.all([exchangeAuthorizationCode(input), exchangeAuthorizationCode(input)])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
  })

  it("expires after 60 seconds", async () => {
    const client = await register()
    const { code, verifier, redirectUri } = await consent(USER_A, client.client_id)
    const late = new Date(Date.now() + 61_000)
    expect(await exchangeAuthorizationCode({ code, clientId: client.client_id, redirectUri, codeVerifier: verifier }, late)).toMatchObject({ ok: false, error: "invalid_grant" })
  })

  it.each([
    ["the wrong verifier", { codeVerifier: randomBytes(32).toString("base64url") }],
    ["the challenge sent as a plain verifier", { codeVerifier: "challenge" }],
    ["another redirect_uri", { redirectUri: LOOPBACK }],
    ["another resource", { resource: "https://other.example/api/mcp" }],
  ])("rejects %s, and the code stays burned", async (_name, override) => {
    const client = await register()
    const { code, verifier, redirectUri } = await consent(USER_A, client.client_id)
    const good = { code, clientId: client.client_id, redirectUri, codeVerifier: verifier }
    expect((await exchangeAuthorizationCode({ ...good, ...override })).ok).toBe(false)
    expect((await exchangeAuthorizationCode(good)).ok).toBe(false)
  })

  it("rejects a code presented by a different client", async () => {
    const client = await register()
    const other = await register()
    const { code, verifier, redirectUri } = await consent(USER_A, client.client_id)
    expect(await exchangeAuthorizationCode({ code, clientId: other.client_id, redirectUri, codeVerifier: verifier })).toMatchObject({ ok: false, error: "invalid_grant" })
  })

  it("rejects an unknown code", async () => {
    const client = await register()
    expect(await exchangeAuthorizationCode({ code: "nope", clientId: client.client_id, redirectUri: REDIRECT, codeVerifier: randomBytes(32).toString("base64url") })).toMatchObject({ ok: false })
  })

  it("stores only hashes: no code, access token or refresh token appears in the database", async () => {
    const client = await register()
    const { code, verifier, redirectUri } = await consent(USER_A, client.client_id)
    const result = await exchangeAuthorizationCode({ code, clientId: client.client_id, redirectUri, codeVerifier: verifier })
    if (!result.ok) throw new Error("exchange failed")
    const dump = JSON.stringify([await db.select().from(oauthAuthorizationCodes), await db.select().from(oauthTokens), await db.select().from(oauthGrants)])
    for (const secret of [code, verifier, result.body.access_token, result.body.refresh_token]) expect(dump).not.toContain(secret)
  })

  it("authorizing the same app again replaces the previous connection", async () => {
    const client = await register()
    const first = await connect(USER_A, client.client_id)
    const second = await connect(USER_A, client.client_id, { write: true })
    expect(await authenticateOAuthAccessToken(first.access_token)).toBeNull()
    expect(await authenticateOAuthAccessToken(second.access_token)).not.toBeNull()
    expect(await listConnectedApps(USER_A)).toHaveLength(1)
  })
})

describe("access tokens", () => {
  it("expire after an hour", async () => {
    const client = await register()
    const { access_token } = await connect(USER_A, client.client_id)
    expect(await authenticateOAuthAccessToken(access_token, new Date(Date.now() + 59 * MINUTE))).not.toBeNull()
    expect(await authenticateOAuthAccessToken(access_token, new Date(Date.now() + 61 * MINUTE))).toBeNull()
  })

  it("reject unknown, malformed and wrong-prefix tokens", async () => {
    expect(await authenticateOAuthAccessToken("jat_unknown")).toBeNull()
    expect(await authenticateOAuthAccessToken("jc_something")).toBeNull()
    expect(await authenticateOAuthAccessToken("")).toBeNull()
    expect(await authenticateOAuthAccessToken(`jat_${"a".repeat(300)}`)).toBeNull()
  })

  it("are tied to the user who consented: a grant for A never resolves to B", async () => {
    const client = await register()
    const a = await connect(USER_A, client.client_id)
    const b = await connect(USER_B, client.client_id)
    expect((await authenticateOAuthAccessToken(a.access_token))?.userId).toBe(USER_A)
    expect((await authenticateOAuthAccessToken(b.access_token))?.userId).toBe(USER_B)
  })

  it("stop working when the grant is revoked, and last use is recorded", async () => {
    const client = await register()
    const { access_token } = await connect(USER_A, client.client_id)
    await authenticateOAuthAccessToken(access_token)
    const [app] = await listConnectedApps(USER_A)
    expect(app.lastUsedAt).not.toBeNull()
    expect(await revokeConnectedApp(USER_A, app.id)).toBe(true)
    expect(await authenticateOAuthAccessToken(access_token)).toBeNull()
  })
})

describe("refresh tokens", () => {
  it("rotate: a new pair is issued and the old access token keeps working until it expires", async () => {
    const client = await register()
    const first = await connect(USER_A, client.client_id, { write: true })
    const refreshed = await refreshAccessToken({ refreshToken: first.refresh_token, clientId: client.client_id })
    expect(refreshed.ok).toBe(true)
    if (!refreshed.ok) return
    expect(refreshed.body.refresh_token).not.toBe(first.refresh_token)
    expect(refreshed.body.access_token).not.toBe(first.access_token)
    expect(refreshed.body.scope).toBe(`${SCOPE_READ} ${SCOPE_WRITE}`)
    expect(await authenticateOAuthAccessToken(refreshed.body.access_token)).toMatchObject({ userId: USER_A })
  })

  it("detect reuse: replaying a used refresh token revokes the whole grant", async () => {
    const client = await register()
    const first = await connect(USER_A, client.client_id)
    const refreshed = await refreshAccessToken({ refreshToken: first.refresh_token, clientId: client.client_id })
    if (!refreshed.ok) throw new Error("refresh failed")

    expect(await refreshAccessToken({ refreshToken: first.refresh_token, clientId: client.client_id })).toMatchObject({ ok: false, error: "invalid_grant" })
    expect(await authenticateOAuthAccessToken(refreshed.body.access_token)).toBeNull()
    expect(await authenticateOAuthAccessToken(first.access_token)).toBeNull()
    expect(await refreshAccessToken({ refreshToken: refreshed.body.refresh_token, clientId: client.client_id })).toMatchObject({ ok: false })
    expect(await listConnectedApps(USER_A)).toHaveLength(0)
  })

  it("lets exactly one of two concurrent refreshes win", async () => {
    const client = await register()
    const first = await connect(USER_A, client.client_id)
    const input = { refreshToken: first.refresh_token, clientId: client.client_id }
    const results = await Promise.all([refreshAccessToken(input), refreshAccessToken(input)])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
  })

  it("are bound to their client and do not burn when another client presents them", async () => {
    const client = await register()
    const other = await register()
    const first = await connect(USER_A, client.client_id)
    expect(await refreshAccessToken({ refreshToken: first.refresh_token, clientId: other.client_id })).toMatchObject({ ok: false })
    expect((await refreshAccessToken({ refreshToken: first.refresh_token, clientId: client.client_id })).ok).toBe(true)
  })

  it("expire after 30 days and are rejected once the grant is revoked", async () => {
    const client = await register()
    const first = await connect(USER_A, client.client_id)
    expect(await refreshAccessToken({ refreshToken: first.refresh_token, clientId: client.client_id }, new Date(Date.now() + 31 * 24 * 60 * MINUTE))).toMatchObject({ ok: false })

    const second = await connect(USER_A, client.client_id)
    const [app] = await listConnectedApps(USER_A)
    await revokeConnectedApp(USER_A, app.id)
    expect(await refreshAccessToken({ refreshToken: second.refresh_token, clientId: client.client_id })).toMatchObject({ ok: false })
  })
})

describe("revocation", () => {
  it("revoking the refresh token kills the access token too", async () => {
    const client = await register()
    const tokens = await connect(USER_A, client.client_id)
    await revokeToken({ token: tokens.refresh_token, clientId: client.client_id })
    expect(await authenticateOAuthAccessToken(tokens.access_token)).toBeNull()
    expect(await refreshAccessToken({ refreshToken: tokens.refresh_token, clientId: client.client_id })).toMatchObject({ ok: false })
  })

  it("revoking the access token kills the refresh token too", async () => {
    const client = await register()
    const tokens = await connect(USER_A, client.client_id)
    await revokeToken({ token: tokens.access_token, clientId: client.client_id })
    expect(await refreshAccessToken({ refreshToken: tokens.refresh_token, clientId: client.client_id })).toMatchObject({ ok: false })
  })

  it("is ignored when another client asks, and for unknown tokens", async () => {
    const client = await register()
    const other = await register()
    const tokens = await connect(USER_A, client.client_id)
    await revokeToken({ token: tokens.access_token, clientId: other.client_id })
    await revokeToken({ token: "jat_unknown", clientId: client.client_id })
    expect(await authenticateOAuthAccessToken(tokens.access_token)).not.toBeNull()
  })
})

describe("connected apps", () => {
  it("lists only the user's own connections with scopes, dates and the redirect host", async () => {
    const client = await register([REDIRECT], "Claude")
    await connect(USER_A, client.client_id, { write: true })
    await connect(USER_B, client.client_id)

    const mine = await listConnectedApps(USER_A)
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ clientName: "Claude", redirectHost: "claude.ai", scopes: [SCOPE_READ, SCOPE_WRITE], lastUsedAt: null })
    expect(new Date(mine[0].createdAt).getTime()).toBeGreaterThan(0)
    expect(await listConnectedApps(USER_B)).toHaveLength(1)
  })

  it("only the owner can revoke a connection", async () => {
    const client = await register()
    const tokens = await connect(USER_A, client.client_id)
    const [app] = await listConnectedApps(USER_A)
    expect(await revokeConnectedApp(USER_B, app.id)).toBe(false)
    expect(await authenticateOAuthAccessToken(tokens.access_token)).not.toBeNull()
    expect(await revokeConnectedApp(USER_A, app.id)).toBe(true)
    expect(await revokeConnectedApp(USER_A, app.id)).toBe(false)
  })

  it("deleting the user removes their grants, codes and tokens (cascade)", async () => {
    const client = await register()
    await connect(USER_A, client.client_id)
    await consent(USER_A, client.client_id)
    await db.execute(sql`DELETE FROM profiles WHERE id = ${USER_A}`)
    expect(await db.select().from(oauthGrants)).toHaveLength(0)
    expect(await db.select().from(oauthTokens)).toHaveLength(0)
    expect(await db.select().from(oauthAuthorizationCodes)).toHaveLength(0)
  })
})

describe("prune", () => {
  it("deletes expired codes and tokens, and old revoked grants, but keeps live connections", async () => {
    const client = await register()
    const live = await connect(USER_A, client.client_id)
    await consent(USER_B, client.client_id) // an unused code
    const gone = await connect(USER_B, client.client_id)
    const [bApp] = await listConnectedApps(USER_B)
    await revokeConnectedApp(USER_B, bApp.id)

    const later = new Date(Date.now() + 40 * 24 * 60 * MINUTE)
    const first = await pruneOAuth(new Date())
    expect(first).toMatchObject({ codes: 0, tokens: 0, grants: 0 })
    const result = await pruneOAuth(later)
    expect(result.codes).toBeGreaterThan(0)
    expect(result.tokens).toBeGreaterThan(0)
    expect(result.grants).toBeGreaterThan(0)
    expect(await authenticateOAuthAccessToken(live.access_token, new Date())).toBeNull() // pruned with its expired refresh token
    expect(gone.access_token).toBeTruthy()
  })
})

const DAY = 24 * 60 * MINUTE

describe("connection period (Keep me connected for)", () => {
  const grantRow = async () => (await db.select().from(oauthGrants))[0]
  const newestRefreshExpiry = async () => (await db.select().from(oauthTokens)).map((token) => token.refreshExpiresAt.getTime()).sort((a, b) => b - a)[0]

  it("accepts the offered periods, defaults to 30 days when the field is missing, and rejects anything else", () => {
    const now = new Date("2026-11-20T10:00:00.000Z")
    expect(parseConnectionDuration("30", now)).toEqual({ ok: true, expiresAt: new Date(now.getTime() + 30 * DAY) })
    expect(parseConnectionDuration("90", now)).toEqual({ ok: true, expiresAt: new Date(now.getTime() + 90 * DAY) })
    expect(parseConnectionDuration("365", now)).toEqual({ ok: true, expiresAt: new Date(now.getTime() + 365 * DAY) })
    expect(parseConnectionDuration("forever", now)).toEqual({ ok: true, expiresAt: null })
    expect(parseConnectionDuration(null, now)).toEqual({ ok: true, expiresAt: new Date(now.getTime() + 30 * DAY) })
    for (const bad of ["", "0", "7", "never", "31", "-30", "1e3", "30 ", "all"]) expect(parseConnectionDuration(bad, now)).toEqual({ ok: false })
  })

  it("stores the chosen end on the grant and shows it in Connected apps", async () => {
    const client = await register()
    const before = Date.now()
    await connect(USER_A, client.client_id, { duration: "90" })
    const [app] = await listConnectedApps(USER_A)
    const end = new Date(app.expiresAt!).getTime()
    expect(end).toBeGreaterThanOrEqual(before + 90 * DAY)
    expect(end).toBeLessThan(Date.now() + 90 * DAY + MINUTE)
    expect(app.dailyCreateCap).toBe(100)

    await connect(USER_B, client.client_id, { duration: "forever" })
    expect((await listConnectedApps(USER_B))[0].expiresAt).toBeNull()
  })

  it("caps the refresh token at the end of the period, however it slides", async () => {
    const client = await register()
    const first = await connect(USER_A, client.client_id, { duration: "30" })
    const end = (await grantRow()).expiresAt!.getTime()
    expect(await newestRefreshExpiry()).toBe(end) // the sliding 30 days would have ended at the same moment, never later

    // Refreshing late in the period must not push the refresh token past the end.
    const late = new Date(Date.now() + 29 * DAY)
    const refreshed = await refreshAccessToken({ refreshToken: first.refresh_token, clientId: client.client_id }, late)
    expect(refreshed.ok).toBe(true)
    expect(await newestRefreshExpiry()).toBe(end)
  })

  it("a 90-day period with use at least monthly ends at day 90, not later", async () => {
    const client = await register()
    let tokens = await connect(USER_A, client.client_id, { duration: "90" })
    const end = (await grantRow()).expiresAt!.getTime()
    const start = Date.now()
    for (const day of [29, 58, 87]) {
      const result = await refreshAccessToken({ refreshToken: tokens.refresh_token, clientId: client.client_id }, new Date(start + day * DAY))
      if (!result.ok) throw new Error(`refresh on day ${day}: ${result.description}`)
      tokens = result.body
    }
    expect(await newestRefreshExpiry()).toBe(end)
    expect(await refreshAccessToken({ refreshToken: tokens.refresh_token, clientId: client.client_id }, new Date(end + MINUTE))).toMatchObject({ ok: false, error: "invalid_grant" })
  })

  it("until I revoke it is not capped: the sliding 30 days still applies", async () => {
    const client = await register()
    const first = await connect(USER_A, client.client_id, { duration: "forever" })
    const refreshed = await refreshAccessToken({ refreshToken: first.refresh_token, clientId: client.client_id }, new Date(Date.now() + 200 * DAY - 31 * DAY))
    expect(refreshed.ok).toBe(false) // 169 days idle is past the 30-day refresh window
    const again = await connect(USER_A, client.client_id, { duration: "forever" })
    expect((await refreshAccessToken({ refreshToken: again.refresh_token, clientId: client.client_id }, new Date(Date.now() + 29 * DAY))).ok).toBe(true)
  })

  it("an access token stops working when the period ends, even if its own hour has not run out", async () => {
    const client = await register()
    const first = await connect(USER_A, client.client_id, { duration: "30" })
    const end = (await grantRow()).expiresAt!
    const nearEnd = new Date(end.getTime() - 5 * MINUTE)
    const refreshed = await refreshAccessToken({ refreshToken: first.refresh_token, clientId: client.client_id }, nearEnd)
    if (!refreshed.ok) throw new Error(refreshed.description)
    expect(await authenticateOAuthAccessToken(refreshed.body.access_token, nearEnd)).toMatchObject({ userId: USER_A })
    expect(await authenticateOAuthAccessToken(refreshed.body.access_token, new Date(end.getTime() + MINUTE))).toBeNull()
  })

  it("refusing an expired connection tells the app to connect again", async () => {
    const client = await register()
    const first = await connect(USER_A, client.client_id, { duration: "30" })
    const result = await refreshAccessToken({ refreshToken: first.refresh_token, clientId: client.client_id }, new Date(Date.now() + 31 * DAY))
    expect(result).toMatchObject({ ok: false, description: expect.stringContaining("connect the app again") })
  })

  it("the daily limit is per connection, editable only by its owner", async () => {
    const client = await register()
    await connect(USER_A, client.client_id)
    await connect(USER_B, client.client_id)
    const [mine] = await listConnectedApps(USER_A)
    expect(await setConnectedAppDailyCap(USER_B, mine.id, 5)).toBe(false)
    expect(await setConnectedAppDailyCap(USER_A, mine.id, 0)).toBe(true)
    expect((await listConnectedApps(USER_A))[0].dailyCreateCap).toBe(0)
    expect((await listConnectedApps(USER_B))[0].dailyCreateCap).toBe(100)
    expect(await authenticateOAuthAccessToken((await connect(USER_A, client.client_id)).access_token)).toMatchObject({ dailyCreateCap: 100 }) // reconnecting starts from the default
  })

  it("prune removes a connection whose period ended once its tokens are gone, and not before", async () => {
    const client = await register()
    await connect(USER_A, client.client_id, { duration: "30" })
    const now = new Date()
    expect(await pruneOAuth(new Date(now.getTime() + 10 * DAY))).toMatchObject({ grants: 0, tokens: 0 })
    expect(await pruneOAuth(new Date(now.getTime() + 45 * DAY))).toMatchObject({ grants: 1 })
    expect(await db.select().from(oauthGrants)).toHaveLength(0)
  })
})
