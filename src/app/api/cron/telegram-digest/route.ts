import { verifyCronRequest } from "@/lib/cron/verify-cron-request"
import { buildDigest } from "@/lib/telegram/digest"
import { sendTelegramText } from "@/lib/telegram/client"
import { listDigestSubscribers, setTelegramDigest } from "@/lib/telegram/pairing"

export const runtime = "nodejs"
export const maxDuration = 300

/** Weekly cron: sends the digest to every user who opted in with /digest on. */
export async function POST(request: Request) {
  if ((await verifyCronRequest(request)) === null) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const subscribers = await listDigestSubscribers()
  let sent = 0
  let failed = 0

  for (const { userId, chatId } of subscribers) {
    try {
      const digest = await buildDigest(userId)
      if (!digest) continue
      await sendTelegramText(chatId, digest)
      sent += 1
    } catch (error) {
      failed += 1
      console.error("[cron/telegram-digest] failed for a subscriber", error instanceof Error ? error.message : "Unknown error")
      // A blocked bot (403) can never succeed again; stop trying until they re-enable.
      if (error instanceof Error && /\(403\)/.test(error.message)) await setTelegramDigest(userId, null)
    }
  }

  return Response.json({ ok: true, subscribers: subscribers.length, sent, failed })
}
