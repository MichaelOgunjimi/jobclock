import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { decrypt, encrypt, isEncryptionConfigured } from "./crypto"

const originalSecret = process.env.ENCRYPTION_SECRET

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.ENCRYPTION_SECRET
  } else {
    process.env.ENCRYPTION_SECRET = originalSecret
  }
})

describe("crypto helpers", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = "test-secret"
  })

  it("encrypts and decrypts values with configured secret", () => {
    const encrypted = encrypt("hello world")

    expect(encrypted.startsWith("enc:")).toBe(true)
    expect(encrypted).not.toBe("hello world")
    expect(decrypt(encrypted)).toBe("hello world")
  })

  it("reflects encryption configuration state", () => {
    delete process.env.ENCRYPTION_SECRET
    expect(isEncryptionConfigured()).toBe(false)

    process.env.ENCRYPTION_SECRET = "configured"
    expect(isEncryptionConfigured()).toBe(true)
  })

  it("passes through plain text values", () => {
    expect(decrypt("plain-text")).toBe("plain-text")
    expect(decrypt("ab:cd")).toBe("ab:cd")
    expect(decrypt("ab:cd:ef")).toBe("ab:cd:ef")
    expect(decrypt("abcd:ef:12")).toBe("abcd:ef:12")
  })

  it("throws for tampered payloads", () => {
    const encrypted = encrypt("hello")
    // Pick a replacement char guaranteed to differ from the current last char
    const lastChar = encrypted[encrypted.length - 1]
    const replacement = lastChar === "0" ? "1" : "0"
    const tampered = `${encrypted.slice(0, -1)}${replacement}`
    expect(() => decrypt(tampered)).toThrow(
      "Failed to decrypt value. Check ENCRYPTION_SECRET configuration."
    )
  })

  it("throws when decrypting with wrong key", () => {
    const encrypted = encrypt("hello world")
    process.env.ENCRYPTION_SECRET = "different-secret"
    expect(() => decrypt(encrypted)).toThrow(
      "Failed to decrypt value. Check ENCRYPTION_SECRET configuration."
    )
  })

  it("decrypts legacy (unprefixed) encrypted values", () => {
    const encrypted = encrypt("legacy-value")
    const legacyEncrypted = encrypted.replace(/^enc:/, "")

    expect(decrypt(legacyEncrypted)).toBe("legacy-value")
  })

  it("throws for legacy (unprefixed) encrypted values when key is wrong", () => {
    const encrypted = encrypt("legacy-value")
    const legacyEncrypted = encrypted.replace(/^enc:/, "")

    process.env.ENCRYPTION_SECRET = "different-secret"
    expect(() => decrypt(legacyEncrypted)).toThrow(
      "Failed to decrypt value. Check ENCRYPTION_SECRET configuration."
    )
  })

  it("throws on encrypt when secret is missing", () => {
    delete process.env.ENCRYPTION_SECRET
    expect(() => encrypt("hello")).toThrow(
      "ENCRYPTION_SECRET environment variable is required for API key encryption"
    )
  })
})
