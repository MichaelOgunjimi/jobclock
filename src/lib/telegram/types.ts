import { z } from "zod/v4"

const telegramUpdateSchema = z.object({
  update_id: z.number().int().nonnegative().safe(),
  message: z.object({
    message_id: z.number().int().safe(),
    chat: z.object({
      id: z.number().int().safe(),
      type: z.literal("private"),
    }),
    from: z.object({
      id: z.number().int().safe(),
      is_bot: z.literal(false),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      username: z.string().optional(),
    }),
    text: z.string(),
  }),
})

export interface TelegramInboundText {
  updateId: number
  messageId: number
  chatId: string
  telegramUserId: string
  username: string | null
  displayName: string | null
  body: string
}

export function parseTelegramInboundText(payload: unknown): TelegramInboundText | null {
  const parsed = telegramUpdateSchema.safeParse(payload)
  if (!parsed.success) return null

  const { update_id: updateId, message } = parsed.data
  if (message.chat.id !== message.from.id) return null

  const displayName = [message.from.first_name, message.from.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || null

  return {
    updateId,
    messageId: message.message_id,
    chatId: String(message.chat.id),
    telegramUserId: String(message.from.id),
    username: message.from.username?.trim() || null,
    displayName,
    body: message.text.trim(),
  }
}
