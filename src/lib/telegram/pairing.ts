import { randomBytes } from "crypto"
import { and, eq, gt } from "drizzle-orm"
import { db } from "@/lib/db"
import { telegramConnections, telegramPairingTokens } from "@/lib/db/schema"
import { decrypt, encrypt } from "@/lib/crypto"
import { hashTelegramIdentity } from "./security"

const PAIRING_TTL_MINUTES = 15

export interface TelegramConnectionMetadata {
  userIdLastFour: string
  username: string | null
  displayName: string | null
  connectedAt: string
  lastMessageAt: string | null
}

function toMetadata(
  connection: typeof telegramConnections.$inferSelect
): TelegramConnectionMetadata {
  return {
    userIdLastFour: connection.telegramUserLastFour,
    username: connection.username,
    displayName: connection.displayName,
    connectedAt: connection.connectedAt.toISOString(),
    lastMessageAt: connection.lastMessageAt?.toISOString() ?? null,
  }
}

export async function getTelegramConnection(
  userId: string
): Promise<TelegramConnectionMetadata | null> {
  const [connection] = await db
    .select()
    .from(telegramConnections)
    .where(eq(telegramConnections.userId, userId))
    .limit(1)

  return connection ? toMetadata(connection) : null
}

export async function generateTelegramPairingToken(userId: string): Promise<{
  token: string
  expiresAt: string
}> {
  const token = randomBytes(24).toString("base64url")
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MINUTES * 60_000)

  await db.transaction(async (tx) => {
    await tx.delete(telegramPairingTokens).where(eq(telegramPairingTokens.userId, userId))
    await tx.insert(telegramPairingTokens).values({
      userId,
      tokenHash: hashTelegramIdentity(`pair:${token}`),
      expiresAt,
    })
  })

  return { token, expiresAt: expiresAt.toISOString() }
}

export type TelegramPairingResult =
  | { status: "connected"; userId: string }
  | { status: "invalid" }
  | { status: "already_connected_elsewhere" }

export async function consumeTelegramPairingToken(input: {
  token: string
  telegramUserId: string
  username: string | null
  displayName: string | null
}): Promise<TelegramPairingResult> {
  const tokenHash = hashTelegramIdentity(`pair:${input.token}`)
  const telegramUserIdHash = hashTelegramIdentity(`user:${input.telegramUserId}`)

  return db.transaction(async (tx) => {
    const [pairing] = await tx
      .delete(telegramPairingTokens)
      .where(and(
        eq(telegramPairingTokens.tokenHash, tokenHash),
        gt(telegramPairingTokens.expiresAt, new Date())
      ))
      .returning({ userId: telegramPairingTokens.userId })

    if (!pairing) return { status: "invalid" as const }

    const [owner] = await tx
      .select({ userId: telegramConnections.userId })
      .from(telegramConnections)
      .where(eq(telegramConnections.telegramUserIdHash, telegramUserIdHash))
      .limit(1)

    if (owner && owner.userId !== pairing.userId) {
      return { status: "already_connected_elsewhere" as const }
    }

    await tx
      .insert(telegramConnections)
      .values({
        userId: pairing.userId,
        telegramUserIdHash,
        telegramUserLastFour: input.telegramUserId.slice(-4),
        username: input.username,
        displayName: input.displayName,
        lastMessageAt: new Date(),
      })
      .onConflictDoUpdate({
        target: telegramConnections.userId,
        set: {
          telegramUserIdHash,
          telegramUserLastFour: input.telegramUserId.slice(-4),
          username: input.username,
          displayName: input.displayName,
          connectedAt: new Date(),
          lastMessageAt: new Date(),
        },
      })

    return { status: "connected" as const, userId: pairing.userId }
  })
}

export async function disconnectTelegram(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(telegramPairingTokens).where(eq(telegramPairingTokens.userId, userId))
    await tx.delete(telegramConnections).where(eq(telegramConnections.userId, userId))
  })
}

export async function findTelegramUser(telegramUserId: string): Promise<string | null> {
  const [connection] = await db
    .select({ userId: telegramConnections.userId })
    .from(telegramConnections)
    .where(eq(
      telegramConnections.telegramUserIdHash,
      hashTelegramIdentity(`user:${telegramUserId}`)
    ))
    .limit(1)

  return connection?.userId ?? null
}

export async function touchTelegramConnection(userId: string): Promise<void> {
  await db
    .update(telegramConnections)
    .set({ lastMessageAt: new Date() })
    .where(eq(telegramConnections.userId, userId))
}

/**
 * Turns the weekly digest on or off. The private chat id is stored (encrypted) only
 * while the digest is enabled, and cleared when it is disabled.
 */
export async function setTelegramDigest(userId: string, chatId: string | null): Promise<void> {
  await db
    .update(telegramConnections)
    .set({
      digestEnabled: chatId !== null,
      chatIdEncrypted: chatId === null ? null : encrypt(chatId),
    })
    .where(eq(telegramConnections.userId, userId))
}

export async function isTelegramDigestEnabled(userId: string): Promise<boolean> {
  const [connection] = await db
    .select({ enabled: telegramConnections.digestEnabled })
    .from(telegramConnections)
    .where(eq(telegramConnections.userId, userId))
    .limit(1)
  return connection?.enabled ?? false
}

/** Everyone who opted in to the digest, with their decrypted chat id. */
export async function listDigestSubscribers(): Promise<Array<{ userId: string; chatId: string }>> {
  const rows = await db
    .select({ userId: telegramConnections.userId, chatIdEncrypted: telegramConnections.chatIdEncrypted })
    .from(telegramConnections)
    .where(eq(telegramConnections.digestEnabled, true))

  return rows.flatMap((row) =>
    row.chatIdEncrypted ? [{ userId: row.userId, chatId: decrypt(row.chatIdEncrypted) }] : []
  )
}
