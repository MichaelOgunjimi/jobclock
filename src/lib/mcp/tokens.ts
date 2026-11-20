import { createHash, randomBytes } from "crypto"
import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm"
import { db } from "@/lib/db"
import { apiTokens } from "@/lib/db/schema"
import {
  DEFAULT_TOKEN_ACCESS,
  DEFAULT_TOKEN_EXPIRY,
  resolveExpiry,
  TOKEN_ACCESS_SCOPES,
  TOKEN_EXPIRY_OPTIONS,
  type TokenAccess,
} from "./access-policy"
import { DEFAULT_DAILY_CREATE_CAP, MAX_DAILY_CREATE_CAP } from "./limits"

export const TOKEN_PREFIX = "jc_"

export interface ApiTokenMetadata {
  id: string
  label: string
  tokenPrefix: string
  scopes: string[]
  /** null = never expires. */
  expiresAt: string | null
  dailyCreateCap: number
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

export function hashApiToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex")
}

/** 256 bits of randomness, so a plain SHA-256 is enough: there is nothing to brute-force. */
export function generateRawApiToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`
}

function toMetadata(row: typeof apiTokens.$inferSelect): ApiTokenMetadata {
  return {
    id: row.id,
    label: row.label,
    tokenPrefix: row.tokenPrefix,
    scopes: row.scopes,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    dailyCreateCap: row.dailyCreateCap,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }
}

/** 0 means unlimited. Whole numbers only. */
export function parseDailyCap(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_DAILY_CREATE_CAP ? value : null
}

export const DAILY_CAP_ERROR = `Enter a whole number from 0 to ${MAX_DAILY_CREATE_CAP.toLocaleString("en-GB")}. 0 means no daily limit.`

export interface CreateTokenOptions {
  /** Default: read only. */
  access?: TokenAccess
  /** One of TOKEN_EXPIRY_OPTIONS (default 90 days). */
  expiry?: string
  dailyCreateCap?: number
}

/** Returns the plaintext once; only its hash is stored. */
export async function createApiToken(
  userId: string,
  label: string,
  options: CreateTokenOptions = {},
  now = new Date(),
): Promise<{ token: string; metadata: ApiTokenMetadata } | { error: string }> {
  const trimmed = label.trim()
  if (trimmed.length < 1 || trimmed.length > 60) return { error: "Give the token a name of 1 to 60 characters." }
  const access = options.access ?? DEFAULT_TOKEN_ACCESS
  if (!(access in TOKEN_ACCESS_SCOPES)) return { error: "Choose whether the token is read only or can also make changes." }
  const expiry = resolveExpiry(TOKEN_EXPIRY_OPTIONS, options.expiry ?? DEFAULT_TOKEN_EXPIRY, now)
  if (!expiry.ok) return { error: "Choose how long the token should last." }
  const dailyCreateCap = options.dailyCreateCap === undefined ? DEFAULT_DAILY_CREATE_CAP : parseDailyCap(options.dailyCreateCap)
  if (dailyCreateCap === null) return { error: DAILY_CAP_ERROR }

  const token = generateRawApiToken()
  const [row] = await db
    .insert(apiTokens)
    .values({
      userId,
      label: trimmed,
      tokenHash: hashApiToken(token),
      tokenPrefix: token.slice(0, TOKEN_PREFIX.length + 5),
      scopes: TOKEN_ACCESS_SCOPES[access],
      expiresAt: expiry.expiresAt,
      dailyCreateCap,
    })
    .returning()
  return { token, metadata: toMetadata(row) }
}

export async function listApiTokens(userId: string): Promise<ApiTokenMetadata[]> {
  const rows = await db.select().from(apiTokens).where(eq(apiTokens.userId, userId)).orderBy(desc(apiTokens.createdAt))
  return rows.map(toMetadata)
}

/** Scoped to the owner: a user can only revoke their own tokens. Returns false if there was nothing to revoke. */
export async function revokeApiToken(userId: string, tokenId: string): Promise<boolean> {
  const rows = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id })
  return rows.length > 0
}

/** Scoped to the owner. Returns false if the token is not theirs or was revoked. */
export async function setApiTokenDailyCap(userId: string, tokenId: string, cap: number): Promise<boolean> {
  const rows = await db
    .update(apiTokens)
    .set({ dailyCreateCap: cap })
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id })
  return rows.length > 0
}

export interface ApiTokenAuth {
  tokenId: string
  userId: string
  scopes: string[]
  dailyCreateCap: number
}

/**
 * Looks the token up by hash and stamps last_used_at in one statement, so a revoked or expired token can never
 * authenticate even if it lapses between a read and a write. Null for anything unknown or revoked; a token that is
 * known but past its expiry says so, so the caller can tell the owner instead of a generic "invalid".
 */
export async function authenticateApiToken(rawToken: string, now = new Date()): Promise<ApiTokenAuth | { expired: true; expiredAt: Date } | null> {
  if (!rawToken.startsWith(TOKEN_PREFIX) || rawToken.length > 200) return null
  const tokenHash = hashApiToken(rawToken)
  const [row] = await db
    .update(apiTokens)
    .set({ lastUsedAt: now })
    .where(and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt), or(isNull(apiTokens.expiresAt), gt(apiTokens.expiresAt, now))))
    .returning({ tokenId: apiTokens.id, userId: apiTokens.userId, scopes: apiTokens.scopes, dailyCreateCap: apiTokens.dailyCreateCap })
  if (row) return row

  const [lapsed] = await db
    .select({ expiresAt: apiTokens.expiresAt })
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt), lte(apiTokens.expiresAt, now)))
    .limit(1)
  return lapsed?.expiresAt ? { expired: true, expiredAt: lapsed.expiresAt } : null
}
