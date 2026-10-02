import { randomBytes } from "crypto"
import { and, eq, gt } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  whatsappConnections,
  whatsappPairingCodes,
} from "@/lib/db/schema"
import { hashWhatsAppIdentity } from "./security"

const PAIRING_TTL_MINUTES = 15
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

export interface WhatsAppConnectionMetadata {
  phoneLastFour: string
  displayName: string | null
  connectedAt: string
  lastMessageAt: string | null
}

function createPairingCode(length = 8): string {
  const bytes = randomBytes(length)
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("")
}

function toMetadata(
  connection: typeof whatsappConnections.$inferSelect
): WhatsAppConnectionMetadata {
  return {
    phoneLastFour: connection.phoneLastFour,
    displayName: connection.displayName,
    connectedAt: connection.connectedAt.toISOString(),
    lastMessageAt: connection.lastMessageAt?.toISOString() ?? null,
  }
}

export async function getWhatsAppConnection(
  userId: string
): Promise<WhatsAppConnectionMetadata | null> {
  const [connection] = await db
    .select()
    .from(whatsappConnections)
    .where(eq(whatsappConnections.userId, userId))
    .limit(1)

  return connection ? toMetadata(connection) : null
}

export async function generateWhatsAppPairingCode(userId: string): Promise<{
  code: string
  expiresAt: string
}> {
  const code = createPairingCode()
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MINUTES * 60_000)

  await db.transaction(async (tx) => {
    await tx.delete(whatsappPairingCodes).where(eq(whatsappPairingCodes.userId, userId))
    await tx.insert(whatsappPairingCodes).values({
      userId,
      codeHash: hashWhatsAppIdentity(`pair:${code}`),
      expiresAt,
    })
  })

  return { code, expiresAt: expiresAt.toISOString() }
}

export type PairingResult =
  | { status: "connected"; userId: string }
  | { status: "invalid" }
  | { status: "already_connected_elsewhere" }

export async function consumeWhatsAppPairingCode(input: {
  code: string
  waId: string
  displayName: string | null
}): Promise<PairingResult> {
  const codeHash = hashWhatsAppIdentity(`pair:${input.code.toUpperCase()}`)
  const waIdHash = hashWhatsAppIdentity(`sender:${input.waId}`)

  return db.transaction(async (tx) => {
    const [pairing] = await tx
      .delete(whatsappPairingCodes)
      .where(and(
        eq(whatsappPairingCodes.codeHash, codeHash),
        gt(whatsappPairingCodes.expiresAt, new Date())
      ))
      .returning({ userId: whatsappPairingCodes.userId })

    if (!pairing) return { status: "invalid" as const }

    const [owner] = await tx
      .select({ userId: whatsappConnections.userId })
      .from(whatsappConnections)
      .where(eq(whatsappConnections.waIdHash, waIdHash))
      .limit(1)

    if (owner && owner.userId !== pairing.userId) {
      return { status: "already_connected_elsewhere" as const }
    }

    await tx
      .insert(whatsappConnections)
      .values({
        userId: pairing.userId,
        waIdHash,
        phoneLastFour: input.waId.slice(-4),
        displayName: input.displayName,
      })
      .onConflictDoUpdate({
        target: whatsappConnections.userId,
        set: {
          waIdHash,
          phoneLastFour: input.waId.slice(-4),
          displayName: input.displayName,
          connectedAt: new Date(),
          lastMessageAt: new Date(),
        },
      })

    return { status: "connected" as const, userId: pairing.userId }
  })
}

export async function disconnectWhatsApp(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(whatsappPairingCodes).where(eq(whatsappPairingCodes.userId, userId))
    await tx.delete(whatsappConnections).where(eq(whatsappConnections.userId, userId))
  })
}

export async function findWhatsAppUserBySender(waId: string): Promise<string | null> {
  const [connection] = await db
    .select({ userId: whatsappConnections.userId })
    .from(whatsappConnections)
    .where(eq(whatsappConnections.waIdHash, hashWhatsAppIdentity(`sender:${waId}`)))
    .limit(1)

  return connection?.userId ?? null
}

export async function touchWhatsAppConnection(userId: string): Promise<void> {
  await db
    .update(whatsappConnections)
    .set({ lastMessageAt: new Date() })
    .where(eq(whatsappConnections.userId, userId))
}
