import { createHmac } from "crypto"
import { afterEach, describe, expect, it } from "vitest"
import { hashWhatsAppIdentity, verifyWhatsAppSignature } from "./security"

const originalEncryptionSecret = process.env.ENCRYPTION_SECRET
const originalAppSecret = process.env.WHATSAPP_APP_SECRET

afterEach(() => {
  if (originalEncryptionSecret === undefined) delete process.env.ENCRYPTION_SECRET
  else process.env.ENCRYPTION_SECRET = originalEncryptionSecret
  if (originalAppSecret === undefined) delete process.env.WHATSAPP_APP_SECRET
  else process.env.WHATSAPP_APP_SECRET = originalAppSecret
})

describe("WhatsApp security", () => {
  it("creates a stable keyed identity digest without exposing the sender ID", () => {
    process.env.ENCRYPTION_SECRET = "identity-secret"
    const digest = hashWhatsAppIdentity("447700900123")

    expect(digest).toHaveLength(64)
    expect(digest).toBe(hashWhatsAppIdentity("447700900123"))
    expect(digest).not.toContain("447700900123")
  })

  it("validates Meta's SHA-256 webhook signature", () => {
    process.env.WHATSAPP_APP_SECRET = "meta-secret"
    const body = JSON.stringify({ object: "whatsapp_business_account" })
    const signature = `sha256=${createHmac("sha256", "meta-secret").update(body).digest("hex")}`

    expect(verifyWhatsAppSignature(body, signature)).toBe(true)
    expect(verifyWhatsAppSignature(`${body}x`, signature)).toBe(false)
    expect(verifyWhatsAppSignature(body, "sha256=bad")).toBe(false)
  })
})

