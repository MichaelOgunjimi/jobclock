import { createHash, randomBytes } from "crypto"
import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { apiTokens } from "@/lib/db/schema"

export const TOKEN_PREFIX = "jc_"
export const MAX_ACTIVE_TOKENS_PER_USER = 10

export interface ApiTokenMetadata {
  id: string
  label: string
  tokenPrefix: string
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
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }
}

/** Returns the plaintext once; only its hash is stored. */
export async function createApiToken(
  userId: string,
  label: string,
): Promise<{ token: string; metadata: ApiTokenMetadata } | { error: string }> {
  const trimmed = label.trim()
  if (trimmed.length < 1 || trimmed.length > 60) return { error: "Give the token a name of 1 to 60 characters." }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
  if (count >= MAX_ACTIVE_TOKENS_PER_USER) return { error: `You can have at most ${MAX_ACTIVE_TOKENS_PER_USER} active tokens. Revoke one first.` }

  const token = generateRawApiToken()
  const [row] = await db
    .insert(apiTokens)
    .values({ userId, label: trimmed, tokenHash: hashApiToken(token), tokenPrefix: token.slice(0, TOKEN_PREFIX.length + 5) })
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

/**
 * Looks the token up by hash and stamps last_used_at in one statement, so a revoked token can never
 * authenticate even if it is revoked between a read and a write. Null for anything unknown or revoked.
 */
export async function authenticateApiToken(rawToken: string): Promise<{ tokenId: string; userId: string } | null> {
  if (!rawToken.startsWith(TOKEN_PREFIX) || rawToken.length > 200) return null
  const [row] = await db
    .update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(apiTokens.tokenHash, hashApiToken(rawToken)), isNull(apiTokens.revokedAt)))
    .returning({ tokenId: apiTokens.id, userId: apiTokens.userId })
  return row ?? null
}
