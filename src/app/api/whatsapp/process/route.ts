import { z } from "zod/v4"
import { verifyCronRequest } from "@/lib/cron/verify-cron-request"
import { processWhatsAppMessage } from "@/lib/whatsapp/process-message"

export const runtime = "nodejs"
export const maxDuration = 300

const messageSchema = z.object({
  messageId: z.string().min(1),
  from: z.string().min(1),
  displayName: z.string().nullable(),
  body: z.string(),
  phoneNumberId: z.string().min(1),
})

export async function POST(request: Request) {
  const rawBody = await verifyCronRequest(request)
  if (rawBody === null) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let candidate: unknown
  try {
    candidate = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const message = messageSchema.safeParse(candidate)
  if (!message.success) {
    return Response.json({ error: "Invalid message" }, { status: 400 })
  }

  try {
    await processWhatsAppMessage(message.data)
    return Response.json({ ok: true })
  } catch (error) {
    console.error("[whatsapp] message processing failed", error)
    return Response.json({ error: "Message processing failed" }, { status: 500 })
  }
}

