import { createHmac, timingSafeEqual } from "crypto"

function getIdentitySecret(): string {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET is required for WhatsApp identity protection")
  }
  return secret
}

export function hashWhatsAppIdentity(value: string): string {
  return createHmac("sha256", getIdentitySecret())
    .update(`jobclock:whatsapp:${value.trim()}`)
    .digest("hex")
}

export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false

  const suppliedHex = signatureHeader.slice("sha256=".length)
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false

  const expected = createHmac("sha256", appSecret).update(rawBody).digest()
  const supplied = Buffer.from(suppliedHex, "hex")
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

