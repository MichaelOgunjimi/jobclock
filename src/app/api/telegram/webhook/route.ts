import { after } from "next/server"
import { enqueueTelegramUpdate } from "@/lib/telegram/enqueue"
import { processTelegramMessage } from "@/lib/telegram/process-message"
import { verifyTelegramWebhookSecret } from "@/lib/telegram/security"
import { parseTelegramInboundText } from "@/lib/telegram/types"

export const runtime = "nodejs"
export const maxDuration = 300

export async function POST(request: Request) {
  if (!verifyTelegramWebhookSecret(
    request.headers.get("x-telegram-bot-api-secret-token")
  )) {
    return Response.json({ error: "Invalid secret" }, { status: 401 })
  }

  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_BOT_USERNAME) {
    return Response.json({ error: "Telegram is not configured" }, { status: 503 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const update = parseTelegramInboundText(payload)
  if (!update) return Response.json({ ok: true })

  try {
    const queued = await enqueueTelegramUpdate(update)
    if (!queued) {
      after(async () => {
        try {
          await processTelegramMessage(update)
        } catch (error) {
          console.error(
            "[telegram] background update failed",
            error instanceof Error ? error.message : "Unknown error"
          )
        }
      })
    }
    return Response.json({ ok: true, queued })
  } catch (error) {
    console.error(
      "[telegram] failed to enqueue update",
      error instanceof Error ? error.message : "Unknown error"
    )
    return Response.json({ error: "Unable to accept update" }, { status: 503 })
  }
}
