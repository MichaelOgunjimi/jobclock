import "server-only"

import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { categoryById, type EmailCategory } from "./categories"
import { getEmailPreferences } from "./preferences"
import { sendEmail } from "./send"
import { claimSend, recordSent, releaseSend } from "./sent-log"
import type { RenderedEmail } from "./templates"
import { unsubscribeUrl } from "./unsubscribe-token"

async function getUserEmail(userId: string): Promise<string | null> {
  const rows = await db.execute<{ email: string | null }>(sql`select email from auth.users where id = ${userId}`)
  return rows[0]?.email ?? null
}

interface OptionalEmail {
  userId: string
  category: EmailCategory
  /** What this email is about (a day, a week, an application). The same key is never sent twice to a user. */
  dedupeKey: string
  /** Extra keys to mark as sent once it goes out, e.g. each application listed in a grouped email. */
  recordKeys?: string[]
  /** Skips the address lookup when the caller already has it. */
  to?: string
  /** Gets the signed unsubscribe link, which the email must show in its footer. */
  render: (unsubscribeUrl: string) => RenderedEmail
}

/**
 * The one way to send an email a user can turn off. It sends only if they opted in to the category, never
 * repeats a dedupeKey, adds the unsubscribe link and the one-click List-Unsubscribe headers, and gives the
 * dedupe slot back if the provider refused so the next run retries. Returns whether an email was sent.
 */
export async function sendOptionalEmail({ userId, category, dedupeKey, recordKeys = [], to, render }: OptionalEmail): Promise<boolean> {
  const preferences = await getEmailPreferences(userId)
  if (!preferences[categoryById(category)!.column]) return false

  const address = to ?? (await getUserEmail(userId))
  if (!address) return false

  let link: string
  try {
    link = unsubscribeUrl(userId, category)
  } catch (err) {
    // Without a signed link the email would have no way to unsubscribe, so it is not sent.
    console.error("[email] cannot sign unsubscribe link:", err instanceof Error ? err.message : err)
    return false
  }

  if (!(await claimSend(userId, category, dedupeKey))) return false

  const sent = await sendEmail({
    to: address,
    ...render(link),
    headers: { "List-Unsubscribe": `<${link}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    idempotencyKey: `${category}/${userId}/${dedupeKey}`,
  })
  if (sent) await recordSent(userId, category, recordKeys)
  else await releaseSend(userId, category, dedupeKey)
  return sent
}
