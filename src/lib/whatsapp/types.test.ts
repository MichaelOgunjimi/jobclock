import { describe, expect, it } from "vitest"
import { parseWhatsAppInboundTexts } from "./types"

describe("parseWhatsAppInboundTexts", () => {
  it("extracts text messages and contact names from a Meta webhook", () => {
    expect(parseWhatsAppInboundTexts({
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
              text: { body: " https://example.com/job " },
            }],
          },
        }],
      }],
    })).toEqual([{
      messageId: "wamid.1",
      from: "447700900123",
      displayName: "Michael",
      body: "https://example.com/job",
      phoneNumberId: "phone-1",
    }])
  })

  it("ignores status callbacks and unsupported message types", () => {
    expect(parseWhatsAppInboundTexts({
      object: "whatsapp_business_account",
      entry: [{
        changes: [{
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: "phone-1" },
            statuses: [{ id: "wamid.1", status: "delivered" }],
          },
        }],
      }],
    })).toEqual([])
  })
})

