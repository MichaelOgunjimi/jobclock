import { PGlite } from "@electric-sql/pglite"
import { sql } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", async () => ({ db: await (await import("@/lib/oauth/test-db")).createOAuthTestDb() }))

import { db } from "@/lib/db"
import { apiTokens } from "@/lib/db/schema"
import { applyMigrations } from "@/lib/oauth/test-db"
import { pruneOAuth } from "@/lib/oauth/tokens"
import { authenticateApiToken, createApiToken, listApiTokens, revokeApiToken, setApiTokenDailyCap } from "./tokens"

const USER = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const NOW = new Date("2026-11-20T10:00:00.000Z")
const DAY = 24 * 60 * 60 * 1000

async function make(label: string, options: Parameters<typeof createApiToken>[2] = {}, userId = USER) {
  const result = await createApiToken(userId, label, options, NOW)
  if ("error" in result) throw new Error(result.error)
  return result
}

beforeEach(async () => {
  await db.execute(sql`TRUNCATE api_tokens, oauth_clients, oauth_grants, oauth_authorization_codes, oauth_tokens, profiles CASCADE`)
  await db.execute(sql`INSERT INTO profiles (id) VALUES (${USER}), (${OTHER})`)
})

describe("migration 0037 on existing data", () => {
  // A fresh in-memory Postgres per test: slow to start when the whole suite runs in parallel.
  it("gives rows that already existed full access, no expiry and the default daily limit", async () => {
    const client = new PGlite()
    await client.exec("CREATE TABLE profiles (id uuid PRIMARY KEY)")
    await client.exec(`INSERT INTO profiles (id) VALUES ('${USER}')`)
    await applyMigrations(client, ["0035_mcp_api_tokens", "0036_mcp_oauth"])
    // Rows written by the code that shipped before this migration.
    await client.exec(`INSERT INTO api_tokens (user_id, label, token_hash, token_prefix) VALUES ('${USER}', 'Old token', 'h1', 'jc_abcde')`)
    await client.exec(`INSERT INTO oauth_clients (id, client_name, redirect_uris) VALUES ('33333333-3333-4333-8333-333333333333', 'Claude', ARRAY['https://claude.ai/cb'])`)
    await client.exec(`INSERT INTO oauth_grants (user_id, client_id, scopes, resource) VALUES ('${USER}', '33333333-3333-4333-8333-333333333333', ARRAY['applications:read'], 'https://jobclock.dev/api/mcp')`)

    await applyMigrations(client, ["0037_mcp_access_controls"])

    const token = (await client.query<{ scopes: string[]; expires_at: Date | null; daily_create_cap: number }>("SELECT scopes, expires_at, daily_create_cap FROM api_tokens")).rows[0]
    expect(token).toEqual({ scopes: ["applications:read", "applications:write"], expires_at: null, daily_create_cap: 100 })
    const grant = (await client.query<{ scopes: string[]; expires_at: Date | null; daily_create_cap: number }>("SELECT scopes, expires_at, daily_create_cap FROM oauth_grants")).rows[0]
    expect(grant).toEqual({ scopes: ["applications:read"], expires_at: null, daily_create_cap: 100 }) // an existing grant keeps the scopes it had and never expires
}, 30_000)
})

describe("manual token scopes", () => {
  it("a read-only token authenticates with only the read scope, a read + changes token with both", async () => {
    const readOnly = await make("Reader", { access: "read" })
    const writer = await make("Writer", { access: "write" })
    expect(await authenticateApiToken(readOnly.token, NOW)).toMatchObject({ userId: USER, scopes: ["applications:read"] })
    expect(await authenticateApiToken(writer.token, NOW)).toMatchObject({ userId: USER, scopes: ["applications:read", "applications:write"] })
  })

  it("defaults to read only, 90 days and a daily limit of 100", async () => {
    const { metadata } = await make("Defaults")
    expect(metadata).toMatchObject({ scopes: ["applications:read"], dailyCreateCap: 100, expiresAt: new Date(NOW.getTime() + 90 * DAY).toISOString() })
  })
})

describe("manual token expiry", () => {
  it("works until the chosen day and then reports that it expired", async () => {
    const { token } = await make("Week", { expiry: "7" })
    expect(await authenticateApiToken(token, new Date(NOW.getTime() + 6 * DAY))).toMatchObject({ userId: USER })
    const after = await authenticateApiToken(token, new Date(NOW.getTime() + 8 * DAY))
    expect(after).toEqual({ expired: true, expiredAt: new Date(NOW.getTime() + 7 * DAY) })
  })

  it("expires each choice at its own time", async () => {
    for (const [expiry, days] of [["7", 7], ["30", 30], ["90", 90], ["365", 365]] as const) {
      const { token } = await make(`T${expiry}`, { expiry })
      expect(await authenticateApiToken(token, new Date(NOW.getTime() + days * DAY - 1000))).toMatchObject({ userId: USER })
      expect(await authenticateApiToken(token, new Date(NOW.getTime() + days * DAY + 1000))).toMatchObject({ expired: true })
    }
  })

  it("a token that never expires still works years later", async () => {
    const { token, metadata } = await make("Forever", { expiry: "never" })
    expect(metadata.expiresAt).toBeNull()
    expect(await authenticateApiToken(token, new Date(NOW.getTime() + 10 * 365 * DAY))).toMatchObject({ userId: USER })
  })

  it("an expired token does not get its last-used time stamped", async () => {
    const { token, metadata } = await make("Lapsed", { expiry: "7" })
    await authenticateApiToken(token, new Date(NOW.getTime() + 8 * DAY))
    expect((await listApiTokens(USER)).find((t) => t.id === metadata.id)?.lastUsedAt).toBeNull()
  })

  it("a revoked token is just invalid, even after it also expired", async () => {
    const { token, metadata } = await make("Revoked", { expiry: "7" })
    await revokeApiToken(USER, metadata.id)
    expect(await authenticateApiToken(token, new Date(NOW.getTime() + 8 * DAY))).toBeNull()
  })

  it("unknown tokens are not reported as expired", async () => {
    expect(await authenticateApiToken("jc_doesnotexist", NOW)).toBeNull()
  })
})

describe("user scoping", () => {
  it("lists and changes only the signed-in owner's tokens", async () => {
    const mine = await make("Mine", {}, USER)
    const theirs = await make("Theirs", {}, OTHER)
    expect((await listApiTokens(USER)).map((token) => token.id)).toEqual([mine.metadata.id])
    expect(await setApiTokenDailyCap(USER, theirs.metadata.id, 5)).toBe(false)
    expect(await setApiTokenDailyCap(USER, mine.metadata.id, 5)).toBe(true)
    expect((await listApiTokens(OTHER))[0].dailyCreateCap).toBe(100)
    expect((await listApiTokens(USER))[0].dailyCreateCap).toBe(5)
  })

  it("a token authenticates as its own owner, never another user", async () => {
    const theirs = await make("Theirs", {}, OTHER)
    expect(await authenticateApiToken(theirs.token, NOW)).toMatchObject({ userId: OTHER })
  })
})

describe("pruning expired tokens", () => {
  it("removes tokens that expired over 30 days ago and keeps recent, live and never-expiring ones", async () => {
    const old = await make("Old", { expiry: "7" })
    const recent = await make("Recent", { expiry: "7" })
    const live = await make("Live", { expiry: "365" })
    const never = await make("Never", { expiry: "never" })
    await db.execute(sql`UPDATE api_tokens SET expires_at = ${new Date(NOW.getTime() - 31 * DAY).toISOString()} WHERE id = ${old.metadata.id}`)
    await db.execute(sql`UPDATE api_tokens SET expires_at = ${new Date(NOW.getTime() - 5 * DAY).toISOString()} WHERE id = ${recent.metadata.id}`)

    expect(await pruneOAuth(NOW)).toMatchObject({ apiTokens: 1 })
    const ids = (await db.select({ id: apiTokens.id }).from(apiTokens)).map((row) => row.id).sort()
    expect(ids).toEqual([recent.metadata.id, live.metadata.id, never.metadata.id].sort())
  })
})

describe("private-data scopes", () => {
  it("a token made with private scopes authenticates with exactly them, and one made without them has none", async () => {
    const withPrivate = await make("Private", { access: "read", extraScopes: ["profile:read", "interview:read"] })
    const plain = await make("Plain", { access: "write" })
    expect(await authenticateApiToken(withPrivate.token, NOW)).toMatchObject({ scopes: ["applications:read", "profile:read", "interview:read"] })
    expect(await authenticateApiToken(plain.token, NOW)).toMatchObject({ scopes: ["applications:read", "applications:write"] })
    expect((await listApiTokens(USER)).find((token) => token.label === "Private")?.scopes).toEqual(["applications:read", "profile:read", "interview:read"])
  })

  it("migration 0039 adds the profile audit table with RLS on and leaves every existing token and grant exactly as it was", async () => {
    const client = new PGlite()
    await client.exec("CREATE TABLE profiles (id uuid PRIMARY KEY)")
    await client.exec(`INSERT INTO profiles (id) VALUES ('${USER}')`)
    await applyMigrations(client, ["0035_mcp_api_tokens", "0036_mcp_oauth", "0037_mcp_access_controls"])
    await client.exec(`INSERT INTO api_tokens (user_id, label, token_hash, token_prefix) VALUES ('${USER}', 'Old token', 'h1', 'jc_abcde')`)
    await client.exec(`INSERT INTO oauth_clients (id, client_name, redirect_uris) VALUES ('33333333-3333-4333-8333-333333333333', 'Claude', ARRAY['https://claude.ai/cb'])`)
    await client.exec(`INSERT INTO oauth_grants (user_id, client_id, scopes, resource) VALUES ('${USER}', '33333333-3333-4333-8333-333333333333', ARRAY['applications:read'], 'https://jobclock.dev/api/mcp')`)

    await applyMigrations(client, ["0039_mcp_profile_audit"])

    expect((await client.query("SELECT scopes FROM api_tokens")).rows[0]).toEqual({ scopes: ["applications:read", "applications:write"] })
    expect((await client.query("SELECT scopes FROM oauth_grants")).rows[0]).toEqual({ scopes: ["applications:read"] })
    expect((await client.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'profile_audit_events'")).rows[0]).toEqual({ relrowsecurity: true })
    await client.exec(`INSERT INTO profile_audit_events (user_id, event_type, metadata) VALUES ('${USER}', 'profile.updated', '{"fields":["phone"]}')`)
    await client.exec(`DELETE FROM profiles WHERE id = '${USER}'`)
    expect((await client.query("SELECT count(*)::int AS n FROM profile_audit_events")).rows[0]).toEqual({ n: 0 }) // removed with the account
}, 30_000)
})
