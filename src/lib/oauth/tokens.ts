import { randomBytes } from "crypto"
import { and, desc, eq, gt, isNotNull, isNull, lt, notExists, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { apiTokens, oauthAuthorizationCodes, oauthClients, oauthGrants, oauthTokens } from "@/lib/db/schema"
import { hashApiToken, limitUpdate, type LimitKind } from "@/lib/mcp/tokens"
import { ACCESS_TOKEN_PREFIX, ACCESS_TOKEN_TTL_SECONDS, isMcpResource, REFRESH_TOKEN_PREFIX, REFRESH_TOKEN_TTL_MS } from "./config"
import { verifyPkce } from "./pkce"

type Db = Pick<typeof db, "insert" | "update" | "select">

export type TokenError = { ok: false; status: 400 | 401; error: "invalid_grant" | "invalid_request" | "invalid_client" | "invalid_target"; description: string }
export type TokenSuccess = {
  ok: true
  body: { access_token: string; token_type: "Bearer"; expires_in: number; refresh_token: string; scope: string }
}

const invalidGrant = (description: string): TokenError => ({ ok: false, status: 400, error: "invalid_grant", description })

// 256 random bits each: a plain SHA-256 is enough, there is nothing to brute-force.
const randomToken = (prefix: string) => `${prefix}${randomBytes(32).toString("base64url")}`

/** The refresh token never outlives the connection: the owner's chosen end (if any) caps the sliding 30 days. */
async function issueTokenPair(tx: Db, grantId: string, scopes: string[], now: Date, grantExpiresAt: Date | null): Promise<TokenSuccess> {
  const accessToken = randomToken(ACCESS_TOKEN_PREFIX)
  const refreshToken = randomToken(REFRESH_TOKEN_PREFIX)
  await tx.insert(oauthTokens).values({
    grantId,
    accessTokenHash: hashApiToken(accessToken),
    refreshTokenHash: hashApiToken(refreshToken),
    accessExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_SECONDS * 1000),
    refreshExpiresAt: new Date(Math.min(now.getTime() + REFRESH_TOKEN_TTL_MS, grantExpiresAt?.getTime() ?? Infinity)),
  })
  return { ok: true, body: { access_token: accessToken, token_type: "Bearer", expires_in: ACCESS_TOKEN_TTL_SECONDS, refresh_token: refreshToken, scope: scopes.join(" ") } }
}

async function revokeGrant(grantId: string, now: Date) {
  await db.update(oauthGrants).set({ revokedAt: now }).where(and(eq(oauthGrants.id, grantId), isNull(oauthGrants.revokedAt)))
}

/**
 * Single-use: the claim (used_at) is one atomic UPDATE, so of two concurrent exchanges exactly one wins. A code that
 * fails any check below stays burned. Replaying a code that already produced tokens revokes that grant (RFC 6749 4.1.2).
 */
export async function exchangeAuthorizationCode(
  input: { code: string; clientId: string; redirectUri: string; codeVerifier: string; resource?: string },
  now = new Date(),
): Promise<TokenSuccess | TokenError> {
  const codeHash = hashApiToken(input.code)
  const [claimed] = await db
    .update(oauthAuthorizationCodes)
    .set({ usedAt: now })
    .where(and(eq(oauthAuthorizationCodes.codeHash, codeHash), isNull(oauthAuthorizationCodes.usedAt), gt(oauthAuthorizationCodes.expiresAt, now)))
    .returning()

  if (!claimed) {
    const [prior] = await db.select({ grantId: oauthAuthorizationCodes.grantId }).from(oauthAuthorizationCodes).where(eq(oauthAuthorizationCodes.codeHash, codeHash)).limit(1)
    if (prior?.grantId) await revokeGrant(prior.grantId, now)
    return invalidGrant("The authorization code is invalid, expired or already used.")
  }

  if (claimed.clientId !== input.clientId) return invalidGrant("The code was issued to a different client.")
  if (claimed.redirectUri !== input.redirectUri) return invalidGrant("redirect_uri does not match the authorization request.")
  if (!verifyPkce(input.codeVerifier, claimed.codeChallenge)) return invalidGrant("PKCE verification failed.")
  if (input.resource !== undefined && (!isMcpResource(input.resource) || input.resource.replace(/\/+$/, "") !== claimed.resource)) {
    return { ok: false, status: 400, error: "invalid_target", description: "resource does not match the authorization request." }
  }

  return db.transaction(async (tx) => {
    // Authorizing again replaces the previous connection of the same app, so the Connected apps list shows it once.
    await tx
      .update(oauthGrants)
      .set({ revokedAt: now })
      .where(and(eq(oauthGrants.userId, claimed.userId), eq(oauthGrants.clientId, claimed.clientId), isNull(oauthGrants.revokedAt)))
    const [grant] = await tx
      .insert(oauthGrants)
      .values({ userId: claimed.userId, clientId: claimed.clientId, scopes: claimed.scopes, resource: claimed.resource, expiresAt: claimed.grantExpiresAt })
      .returning()
    await tx.update(oauthAuthorizationCodes).set({ grantId: grant.id }).where(eq(oauthAuthorizationCodes.id, claimed.id))
    return issueTokenPair(tx, grant.id, grant.scopes, now, grant.expiresAt)
  })
}

/**
 * Rotation: the presented refresh token is marked used in the same atomic UPDATE that checks the client and that the
 * grant is live. Presenting an already-used token means it leaked (or was replayed), so the whole grant is revoked.
 */
export async function refreshAccessToken(input: { refreshToken: string; clientId: string }, now = new Date()): Promise<TokenSuccess | TokenError> {
  const refreshHash = hashApiToken(input.refreshToken)
  const [claimed] = await db
    .update(oauthTokens)
    .set({ refreshUsedAt: now })
    .from(oauthGrants)
    .where(
      and(
        eq(oauthTokens.grantId, oauthGrants.id),
        eq(oauthTokens.refreshTokenHash, refreshHash),
        isNull(oauthTokens.refreshUsedAt),
        gt(oauthTokens.refreshExpiresAt, now),
        eq(oauthGrants.clientId, input.clientId),
        isNull(oauthGrants.revokedAt),
        or(isNull(oauthGrants.expiresAt), gt(oauthGrants.expiresAt, now)),
      ),
    )
    .returning({ grantId: oauthTokens.grantId, scopes: oauthGrants.scopes, grantExpiresAt: oauthGrants.expiresAt })

  if (!claimed) {
    const [prior] = await db.select({ grantId: oauthTokens.grantId, usedAt: oauthTokens.refreshUsedAt }).from(oauthTokens).where(eq(oauthTokens.refreshTokenHash, refreshHash)).limit(1)
    if (prior?.usedAt) await revokeGrant(prior.grantId, now)
    return invalidGrant("The refresh token is invalid, expired or revoked. If the connection reached the end of the period the owner chose, or the app was not used for 30 days, connect the app again.")
  }
  return db.transaction((tx) => issueTokenPair(tx, claimed.grantId, claimed.scopes, now, claimed.grantExpiresAt))
}

export interface OAuthAuthContext {
  userId: string
  scopes: string[]
  grantId: string
  resource: string
  dailyCreateCap: number
  dailyDeleteCap: number
  dailyCreditCap: number | null
}

/** One statement: unknown, expired and revoked tokens match nothing, so they cannot authenticate even if revoked mid-request. */
export async function authenticateOAuthAccessToken(rawToken: string, now = new Date()): Promise<OAuthAuthContext | null> {
  if (!rawToken.startsWith(ACCESS_TOKEN_PREFIX) || rawToken.length > 200) return null
  const [row] = await db
    .update(oauthGrants)
    .set({ lastUsedAt: now })
    .from(oauthTokens)
    .where(
      and(
        eq(oauthTokens.grantId, oauthGrants.id),
        eq(oauthTokens.accessTokenHash, hashApiToken(rawToken)),
        gt(oauthTokens.accessExpiresAt, now),
        isNull(oauthGrants.revokedAt),
        or(isNull(oauthGrants.expiresAt), gt(oauthGrants.expiresAt, now)),
      ),
    )
    .returning({ userId: oauthGrants.userId, scopes: oauthGrants.scopes, grantId: oauthGrants.id, resource: oauthGrants.resource, dailyCreateCap: oauthGrants.dailyCreateCap, dailyDeleteCap: oauthGrants.dailyDeleteCap, dailyCreditCap: oauthGrants.dailyCreditCap })
  return row ?? null
}

/** RFC 7009 for public clients: a token is only revoked by the client it was issued to. Revoking either token ends the whole grant. */
export async function revokeToken(input: { token: string; clientId: string }, now = new Date()): Promise<void> {
  const hash = hashApiToken(input.token)
  const [row] = await db
    .select({ grantId: oauthTokens.grantId })
    .from(oauthTokens)
    .innerJoin(oauthGrants, eq(oauthTokens.grantId, oauthGrants.id))
    .where(and(or(eq(oauthTokens.accessTokenHash, hash), eq(oauthTokens.refreshTokenHash, hash)), eq(oauthGrants.clientId, input.clientId)))
    .limit(1)
  if (row) await revokeGrant(row.grantId, now)
}

export interface ConnectedApp {
  id: string
  clientName: string
  redirectHost: string
  scopes: string[]
  /** null = until revoked. */
  expiresAt: string | null
  dailyCreateCap: number
  dailyDeleteCap: number
  /** null = no limit. */
  dailyCreditCap: number | null
  createdAt: string
  lastUsedAt: string | null
}

function hostOf(uri: string | undefined) {
  try {
    return uri ? new URL(uri).host : "unknown"
  } catch {
    return "unknown"
  }
}

export async function listConnectedApps(userId: string): Promise<ConnectedApp[]> {
  const rows = await db
    .select({
      id: oauthGrants.id,
      clientName: oauthClients.clientName,
      redirectUris: oauthClients.redirectUris,
      scopes: oauthGrants.scopes,
      expiresAt: oauthGrants.expiresAt,
      dailyCreateCap: oauthGrants.dailyCreateCap,
      dailyDeleteCap: oauthGrants.dailyDeleteCap,
      dailyCreditCap: oauthGrants.dailyCreditCap,
      createdAt: oauthGrants.createdAt,
      lastUsedAt: oauthGrants.lastUsedAt,
    })
    .from(oauthGrants)
    .innerJoin(oauthClients, eq(oauthGrants.clientId, oauthClients.id))
    .where(and(eq(oauthGrants.userId, userId), isNull(oauthGrants.revokedAt)))
    .orderBy(desc(oauthGrants.createdAt))
  return rows.map((row) => ({
    id: row.id,
    clientName: row.clientName,
    redirectHost: hostOf(row.redirectUris[0]),
    scopes: row.scopes,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    dailyCreateCap: row.dailyCreateCap,
    dailyDeleteCap: row.dailyDeleteCap,
    dailyCreditCap: row.dailyCreditCap,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  }))
}

/** Scoped to the owner. Returns false when the connection is not theirs or was removed. */
export async function setConnectedAppDailyCap(userId: string, grantId: string, cap: number | null, kind: LimitKind = "create"): Promise<boolean> {
  const rows = await db
    .update(oauthGrants)
    .set(limitUpdate(kind, cap))
    .where(and(eq(oauthGrants.id, grantId), eq(oauthGrants.userId, userId), isNull(oauthGrants.revokedAt)))
    .returning({ id: oauthGrants.id })
  return rows.length > 0
}

/** Scoped to the owner. Returns false when there was nothing to revoke. */
export async function revokeConnectedApp(userId: string, grantId: string, now = new Date()): Promise<boolean> {
  const rows = await db
    .update(oauthGrants)
    .set({ revokedAt: now })
    .where(and(eq(oauthGrants.id, grantId), eq(oauthGrants.userId, userId), isNull(oauthGrants.revokedAt)))
    .returning({ id: oauthGrants.id })
  return rows.length > 0
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Deletes what can no longer be used. Used refresh tokens are kept until they expire so reuse detection still works. An expired connection has no live token left, so it goes with them once it is over 31 days old; an expired manual token is kept 30 days so Settings can still show it as Expired. */
export async function pruneOAuth(now = new Date()) {
  const codes = await db.delete(oauthAuthorizationCodes).where(lt(oauthAuthorizationCodes.expiresAt, new Date(now.getTime() - DAY_MS))).returning({ id: oauthAuthorizationCodes.id })
  const tokens = await db.delete(oauthTokens).where(lt(oauthTokens.refreshExpiresAt, now)).returning({ id: oauthTokens.id })
  const grants = await db
    .delete(oauthGrants)
    .where(
      or(
        and(isNotNull(oauthGrants.revokedAt), lt(oauthGrants.revokedAt, new Date(now.getTime() - 30 * DAY_MS))),
        and(
          lt(oauthGrants.createdAt, new Date(now.getTime() - 31 * DAY_MS)),
          notExists(db.select({ one: sql`1` }).from(oauthTokens).where(eq(oauthTokens.grantId, oauthGrants.id))),
        ),
      ),
    )
    .returning({ id: oauthGrants.id })
  const clients = await db
    .delete(oauthClients)
    .where(and(lt(oauthClients.createdAt, new Date(now.getTime() - 90 * DAY_MS)), notExists(db.select({ one: sql`1` }).from(oauthGrants).where(eq(oauthGrants.clientId, oauthClients.id)))))
    .returning({ id: oauthClients.id })
  const staleApiTokens = await db
    .delete(apiTokens)
    .where(lt(apiTokens.expiresAt, new Date(now.getTime() - 30 * DAY_MS)))
    .returning({ id: apiTokens.id })
  return { codes: codes.length, tokens: tokens.length, grants: grants.length, clients: clients.length, apiTokens: staleApiTokens.length }
}
