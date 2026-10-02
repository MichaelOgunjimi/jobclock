import { createHmac, timingSafeEqual } from "crypto"

function getIdentitySecret(): string {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) throw new Error("ENCRYPTION_SECRET is required for Telegram identity protection")
  return secret
}

export function hashTelegramIdentity(value: string): string {
  return createHmac("sha256", getIdentitySecret())
    .update(`jobclock:telegram:${value.trim()}`)
    .digest("hex")
}

export function verifyTelegramWebhookSecret(value: string | null): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret || !value) return false

  const expected = Buffer.from(secret)
  const supplied = Buffer.from(value)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
