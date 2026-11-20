import { createHmac, timingSafeEqual } from "node:crypto"
import { getAppUrl } from "@/lib/site"
import { EMAIL_CATEGORY_IDS, type EmailCategory } from "./categories"

/** `all` turns off every optional email; otherwise one category. */
export type UnsubscribeScope = EmailCategory | "all"

function sign(payload: string): string {
  const secret = process.env.ENCRYPTION_SECRET
  if (!secret) throw new Error("ENCRYPTION_SECRET is required to sign unsubscribe links")
  // A key derived for this one purpose, so a link signature can never be confused with anything else the secret protects.
  const key = createHmac("sha256", secret).update("jobclock:email-unsubscribe:v1").digest()
  return createHmac("sha256", key).update(payload).digest("base64url")
}

/** A link token has no expiry on purpose: an unsubscribe link in an old email must keep working. */
export function signUnsubscribeToken(userId: string, scope: UnsubscribeScope): string {
  const payload = `${userId}.${scope}`
  return `${payload}.${sign(payload)}`
}

export function verifyUnsubscribeToken(token: string): { userId: string; scope: UnsubscribeScope } | null {
  const [userId, scope, signature, ...rest] = token.split(".")
  if (!userId || !scope || !signature || rest.length > 0) return null
  if (scope !== "all" && !EMAIL_CATEGORY_IDS.includes(scope)) return null

  let expected: string
  try {
    expected = sign(`${userId}.${scope}`)
  } catch {
    return null
  }
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  return { userId, scope: scope as UnsubscribeScope }
}

export function unsubscribeUrl(userId: string, scope: UnsubscribeScope): string {
  return `${getAppUrl()}/api/email/unsubscribe?t=${encodeURIComponent(signUnsubscribeToken(userId, scope))}`
}
