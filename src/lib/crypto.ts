import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const ENCODING = "hex" as const

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) {
    throw new Error("ENCRYPTION_SECRET environment variable is required for API key encryption")
  }
  return createHash("sha256").update(secret).digest()
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, "utf8", ENCODING)
  encrypted += cipher.final(ENCODING)
  const authTag = cipher.getAuthTag().toString(ENCODING)
  return `${iv.toString(ENCODING)}:${encrypted}:${authTag}`
}

export function decrypt(encryptedValue: string): string {
  const parts = encryptedValue.split(":")
  if (parts.length !== 3) return encryptedValue
  if (parts[0].length !== IV_LENGTH * 2) return encryptedValue

  try {
    const key = getEncryptionKey()
    const iv = Buffer.from(parts[0], ENCODING)
    const encrypted = parts[1]
    const authTag = Buffer.from(parts[2], ENCODING)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encrypted, ENCODING, "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch {
    return encryptedValue
  }
}

export function isEncryptionConfigured(): boolean {
  return !!process.env.ENCRYPTION_SECRET
}
