import { z } from "zod/v4"
import { verifyCronRequest } from "@/lib/cron/verify-cron-request"
import { processTelegramMessage } from "@/lib/telegram/process-message"

export const runtime = "nodejs"
export const maxDuration = 300

const updateSchema = z.object({
  updateId: z.number().int().nonnegative().safe(),
  messageId: z.number().int().safe(),
  chatId: z.string().min(1),
  telegramUserId: z.string().min(1),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  body: z.string(),
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

  const update = updateSchema.safeParse(candidate)
  if (!update.success) {
    return Response.json({ error: "Invalid update" }, { status: 400 })
  }

  try {
    await processTelegramMessage(update.data)
    return Response.json({ ok: true })
  } catch (error) {
    console.error(
      "[telegram] update processing failed",
      error instanceof Error ? error.message : "Unknown error"
    )
    return Response.json({ error: "Update processing failed" }, { status: 500 })
  }
}
