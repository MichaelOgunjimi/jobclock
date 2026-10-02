import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/server", () => ({ after: vi.fn() }))
vi.mock("@/lib/telegram/enqueue", () => ({ enqueueTelegramUpdate: vi.fn() }))
vi.mock("@/lib/telegram/process-message", () => ({ processTelegramMessage: vi.fn() }))

import { enqueueTelegramUpdate } from "@/lib/telegram/enqueue"
import { POST } from "./route"

const originalEnv = {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
}

function telegramRequest(secret: string) {
  return new Request("https://jobclock.example/api/telegram/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": secret,
    },
    body: JSON.stringify({
      update_id: 42,
      message: {
        message_id: 7,
        chat: { id: 123456789, type: "private" },
        from: {
          id: 123456789,
          is_bot: false,
          first_name: "Michael",
          username: "michael",
        },
        text: "https://example.com/job",
      },
    }),
  })
}

describe("Telegram webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TELEGRAM_BOT_TOKEN = "bot-token"
    process.env.TELEGRAM_BOT_USERNAME = "JobClockBot"
    process.env.TELEGRAM_WEBHOOK_SECRET = "webhook-secret"
    vi.mocked(enqueueTelegramUpdate).mockResolvedValue(true)
  })

  afterEach(() => {
    const names = {
      botToken: "TELEGRAM_BOT_TOKEN",
      botUsername: "TELEGRAM_BOT_USERNAME",
      webhookSecret: "TELEGRAM_WEBHOOK_SECRET",
    } as const
    for (const [key, envName] of Object.entries(names)) {
      const value = originalEnv[key as keyof typeof originalEnv]
      if (value === undefined) delete process.env[envName]
      else process.env[envName] = value
    }
  })

  it("rejects a bad webhook secret", async () => {
    const response = await POST(telegramRequest("wrong-secret"))

    expect(response.status).toBe(401)
    expect(enqueueTelegramUpdate).not.toHaveBeenCalled()
  })

  it("accepts and dispatches a valid private text update", async () => {
    const response = await POST(telegramRequest("webhook-secret"))

    expect(response.status).toBe(200)
    expect(enqueueTelegramUpdate).toHaveBeenCalledWith(expect.objectContaining({
      updateId: 42,
      telegramUserId: "123456789",
      body: "https://example.com/job",
    }))
  })
})
