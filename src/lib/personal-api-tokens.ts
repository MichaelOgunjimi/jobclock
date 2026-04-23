import { createHash, randomBytes } from "crypto"
import { and, desc, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { personalApiTokens } from "@/lib/db/schema"

export interface PersonalApiTokenMetadata {
  id: string
  tokenPrefix: string
  createdAt: string
  lastUsedAt: string | null
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex")
}

function toMetadata(record: typeof personalApiTokens.$inferSelect): PersonalApiTokenMetadata {
  return {
    id: record.id,
    tokenPrefix: record.tokenPrefix,
    createdAt: record.createdAt.toISOString(),
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
  }
}

export async function getActivePersonalApiTokenMetadata(userId: string): Promise<PersonalApiTokenMetadata | null> {
  const [record] = await db
    .select()
    .from(personalApiTokens)
    .where(and(eq(personalApiTokens.userId, userId), isNull(personalApiTokens.revokedAt)))
    .orderBy(desc(personalApiTokens.createdAt))
    .limit(1)

  return record ? toMetadata(record) : null
}

export async function generatePersonalApiToken(userId: string): Promise<{ token: string; metadata: PersonalApiTokenMetadata }> {
  const rawToken = `ja_ext_${randomBytes(24).toString("hex")}`
  const tokenHash = hashToken(rawToken)
  const tokenPrefix = rawToken.slice(0, 12)

  await db
    .update(personalApiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(personalApiTokens.userId, userId), isNull(personalApiTokens.revokedAt)))

  const [record] = await db
    .insert(personalApiTokens)
    .values({
      userId,
      tokenHash,
      tokenPrefix,
    })
    .returning()

  return {
    token: rawToken,
    metadata: toMetadata(record),
  }
}

export async function revokePersonalApiTokens(userId: string): Promise<void> {
  await db
    .update(personalApiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(personalApiTokens.userId, userId), isNull(personalApiTokens.revokedAt)))
}

export async function authenticatePersonalApiToken(rawToken: string): Promise<{ tokenId: string; userId: string } | null> {
  const tokenHash = hashToken(rawToken.trim())
  const [record] = await db
    .select({
      id: personalApiTokens.id,
      userId: personalApiTokens.userId,
    })
    .from(personalApiTokens)
    .where(and(eq(personalApiTokens.tokenHash, tokenHash), isNull(personalApiTokens.revokedAt)))
    .limit(1)

  if (!record) return null

  return {
    tokenId: record.id,
    userId: record.userId,
  }
}

export async function touchPersonalApiToken(tokenId: string): Promise<void> {
  await db
    .update(personalApiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(personalApiTokens.id, tokenId))
}
