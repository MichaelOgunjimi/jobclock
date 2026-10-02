import { z } from "zod/v4"

const textMessageSchema = z.object({
  from: z.string().min(1),
  id: z.string().min(1),
  type: z.literal("text"),
  text: z.object({ body: z.string() }),
})

const changeValueSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  metadata: z.object({ phone_number_id: z.string().min(1) }),
  contacts: z.array(z.object({
    wa_id: z.string().min(1),
    profile: z.object({ name: z.string().optional() }).optional(),
  })).optional(),
  messages: z.array(z.unknown()).optional(),
})

const webhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({
    changes: z.array(z.object({
      field: z.literal("messages"),
      value: changeValueSchema,
    })),
  })),
})

export interface WhatsAppInboundText {
  messageId: string
  from: string
  displayName: string | null
  body: string
  phoneNumberId: string
}

export function parseWhatsAppInboundTexts(payload: unknown): WhatsAppInboundText[] {
  const parsed = webhookSchema.safeParse(payload)
  if (!parsed.success) return []

  const result: WhatsAppInboundText[] = []
  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      const contactById = new Map(
        (change.value.contacts ?? []).map((contact) => [
          contact.wa_id,
          contact.profile?.name?.trim() || null,
        ])
      )

      for (const candidate of change.value.messages ?? []) {
        const message = textMessageSchema.safeParse(candidate)
        if (!message.success) continue
        result.push({
          messageId: message.data.id,
          from: message.data.from,
          displayName: contactById.get(message.data.from) ?? null,
          body: message.data.text.body.trim(),
          phoneNumberId: change.value.metadata.phone_number_id,
        })
      }
    }
  }

  return result
}

