import { Receiver } from "@upstash/qstash"

/**
 * Verifies that an incoming cron request is legitimate.
 *
 * Two accepted paths:
 *  1. QStash-triggered: verifies the `Upstash-Signature` header using the
 *     rotating signing keys (QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY).
 *  2. Manual trigger: checks `Authorization: Bearer <CRON_SECRET>` for
 *     direct invocations (curl, scripts, etc.).
 *
 * Returns the raw request body string on success, or null on auth failure.
 * The body is returned so callers don't have to read it a second time.
 */
export async function verifyCronRequest(req: Request): Promise<string | null> {
  const body = await req.text()
  const signature = req.headers.get("upstash-signature")

  if (signature) {
    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
    if (!currentSigningKey || !nextSigningKey) return null

    try {
      const receiver = new Receiver({ currentSigningKey, nextSigningKey })
      await receiver.verify({ signature, body, url: req.url })
      return body
    } catch {
      return null
    }
  }

  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return body
  }

  return null
}
