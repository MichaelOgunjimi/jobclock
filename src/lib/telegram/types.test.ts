import { describe, expect, it } from "vitest"
import { parseTelegramInboundText } from "./types"

describe("parseTelegramInboundText", () => {
  it("extracts a private text message", () => {
    expect(parseTelegramInboundText({
      update_id: 42,
      message: {
        message_id: 7,
        chat: { id: 123456789, type: "private" },
        from: {
          id: 123456789,
          is_bot: false,
          first_name: "Michael",
          last_name: "Ogunjimi",
          username: "michael",
        },
        text: " https://example.com/job ",
      },
    })).toEqual({
      updateId: 42,
      messageId: 7,
      chatId: "123456789",
      telegramUserId: "123456789",
      username: "michael",
      displayName: "Michael Ogunjimi",
      body: "https://example.com/job",
    })
  })

  it("ignores non-text, group, and bot messages", () => {
    expect(parseTelegramInboundText({ update_id: 1, callback_query: {} })).toBeNull()
    expect(parseTelegramInboundText({
      update_id: 2,
      message: {
        message_id: 8,
        chat: { id: -1001, type: "group" },
        from: { id: 123, is_bot: false },
        text: "hello",
      },
    })).toBeNull()
    expect(parseTelegramInboundText({
      update_id: 3,
      message: {
        message_id: 9,
        chat: { id: 456, type: "private" },
        from: { id: 456, is_bot: true },
        text: "hello",
      },
    })).toBeNull()
  })
})
