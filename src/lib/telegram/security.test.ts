import { afterEach, describe, expect, it } from "vitest"
import { hashTelegramIdentity, verifyTelegramWebhookSecret } from "./security"

const originalEncryptionSecret = process.env.ENCRYPTION_SECRET
const originalWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET

afterEach(() => {
  if (originalEncryptionSecret === undefined) delete process.env.ENCRYPTION_SECRET
  else process.env.ENCRYPTION_SECRET = originalEncryptionSecret
  if (originalWebhookSecret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET
  else process.env.TELEGRAM_WEBHOOK_SECRET = originalWebhookSecret
})

describe("Telegram security", () => {
  it("creates a stable keyed digest without exposing the Telegram user ID", () => {
    process.env.ENCRYPTION_SECRET = "identity-secret"
    const digest = hashTelegramIdentity("123456789")

    expect(digest).toHaveLength(64)
    expect(digest).toBe(hashTelegramIdentity("123456789"))
    expect(digest).not.toContain("123456789")
  })

  it("validates the configured webhook secret", () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = "telegram-webhook-secret"

    expect(verifyTelegramWebhookSecret("telegram-webhook-secret")).toBe(true)
    expect(verifyTelegramWebhookSecret("wrong-secret")).toBe(false)
    expect(verifyTelegramWebhookSecret(null)).toBe(false)
  })
})
