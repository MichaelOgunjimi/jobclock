import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const ENCODING = "hex" as const
const ENCRYPTED_PREFIX = "enc:"

const LEGACY_ENCRYPTED_VALUE_REGEX = /^[0-9a-f]+:[0-9a-f]*:[0-9a-f]+$/i

function isLegacyEncryptedValue(value: string): boolean {
  if (!LEGACY_ENCRYPTED_VALUE_REGEX.test(value)) return false
  const [ivHex] = value.split(":")
  return ivHex.length === IV_LENGTH * 2
}

function decryptParts(parts: string[]): string {
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
    throw new Error("Failed to decrypt value. Check ENCRYPTION_SECRET configuration.")
  }
}

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
  return `${ENCRYPTED_PREFIX}${iv.toString(ENCODING)}:${encrypted}:${authTag}`
}

export function decrypt(encryptedValue: string): string {
  if (!encryptedValue.startsWith(ENCRYPTED_PREFIX)) {
    if (!isLegacyEncryptedValue(encryptedValue)) return encryptedValue
    const parts = encryptedValue.split(":")
    return decryptParts(parts)
  }

  const withoutPrefix = encryptedValue.slice(ENCRYPTED_PREFIX.length)
  const parts = withoutPrefix.split(":")
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted value")
  }

  return decryptParts(parts)
}

export function isEncryptionConfigured(): boolean {
  return !!process.env.ENCRYPTION_SECRET
}
