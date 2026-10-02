import { createHmac } from "crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/server", () => ({ after: vi.fn() }))
vi.mock("@/lib/whatsapp/enqueue", () => ({ enqueueWhatsAppMessages: vi.fn() }))
vi.mock("@/lib/whatsapp/process-message", () => ({ processWhatsAppMessage: vi.fn() }))

import { enqueueWhatsAppMessages } from "@/lib/whatsapp/enqueue"
import { GET, POST } from "./route"

const originalEnv = {
  appSecret: process.env.WHATSAPP_APP_SECRET,
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
}

function signedRequest(payload: unknown) {
  const rawBody = JSON.stringify(payload)
  const signature = createHmac("sha256", process.env.WHATSAPP_APP_SECRET!)
    .update(rawBody)
    .digest("hex")
  return new Request("https://jobclock.example/api/whatsapp/webhook", {
    method: "POST",
    body: rawBody,
    headers: {
      "content-type": "application/json",
      "x-hub-signature-256": `sha256=${signature}`,
    },
  })
}

describe("WhatsApp webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.WHATSAPP_APP_SECRET = "app-secret"
    process.env.WHATSAPP_VERIFY_TOKEN = "verify-me"
    process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-1"
    vi.mocked(enqueueWhatsAppMessages).mockResolvedValue(true)
  })

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      const envKey = key === "appSecret"
        ? "WHATSAPP_APP_SECRET"
        : key === "verifyToken"
          ? "WHATSAPP_VERIFY_TOKEN"
          : "WHATSAPP_PHONE_NUMBER_ID"
      if (value === undefined) delete process.env[envKey]
      else process.env[envKey] = value
    }
  })

  it("completes Meta's webhook verification challenge", async () => {
    const response = await GET(new Request(
      "https://jobclock.example/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345"
    ))

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe("12345")
  })

  it("rejects webhook payloads with an invalid signature", async () => {
    const response = await POST(new Request(
      "https://jobclock.example/api/whatsapp/webhook",
      { method: "POST", body: "{}", headers: { "x-hub-signature-256": "sha256=bad" } }
    ))

    expect(response.status).toBe(401)
    expect(enqueueWhatsAppMessages).not.toHaveBeenCalled()
  })

  it("queues verified text messages for the configured business number", async () => {
    const request = signedRequest({
      object: "whatsapp_business_account",
      entry: [{
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: "phone-1" },
            contacts: [{ wa_id: "447700900123", profile: { name: "Michael" } }],
            messages: [{
              from: "447700900123",
              id: "wamid.1",
              type: "text",
              text: { body: "https://example.com/job" },
            }],
          },
        }],
      }],
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(enqueueWhatsAppMessages).toHaveBeenCalledWith([
      expect.objectContaining({ messageId: "wamid.1", from: "447700900123" }),
    ])
  })
})

