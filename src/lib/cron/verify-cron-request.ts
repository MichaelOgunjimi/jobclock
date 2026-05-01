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
 *
 * Note: We intentionally do NOT pass `url` to `Receiver.verify`. QStash signs
 * a specific destination URL, but the URL Vercel exposes inside the function
 * (req.url) often differs from that — internal deployment domain vs custom
 * domain, trailing slashes, protocol — which silently breaks verification.
 * Skipping the URL claim keeps the body+signature integrity check, which is
 * what actually proves the request came from QStash (no one else holds the
 * signing keys).
 */
export async function verifyCronRequest(req: Request): Promise<string | null> {
  const body = await req.text()
  const signature = req.headers.get("upstash-signature")

  if (signature) {
    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
    if (!currentSigningKey || !nextSigningKey) {
      console.error("[verifyCronRequest] missing QSTASH signing keys in env")
      return null
    }

    try {
      const receiver = new Receiver({ currentSigningKey, nextSigningKey })
      await receiver.verify({ signature, body })
      return body
    } catch (err) {
      console.error(
        "[verifyCronRequest] qstash signature verification failed:",
        err instanceof Error ? err.message : err,
      )
      return null
    }
  }

  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return body
  }

  if (!cronSecret) {
    console.error("[verifyCronRequest] no upstash-signature and CRON_SECRET not configured")
  } else {
    console.error("[verifyCronRequest] no upstash-signature and bearer token did not match CRON_SECRET")
  }
  return null
}
