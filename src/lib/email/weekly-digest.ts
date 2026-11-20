import { getDigestData } from "@/lib/telegram/digest"
import { sendOptionalEmail } from "./optional"
import { listOptedIn } from "./preferences"
import { weeklyDigestEmail } from "./templates"

/** The Monday (UTC) of the week a date falls in, e.g. 2026-11-16. One digest per user per such week. */
export function weekKey(now: Date): string {
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)))
  return monday.toISOString().slice(0, 10)
}

// shortcut: loads every opted-in user and sends one at a time; batch it if opted-in users reach the thousands.
export async function sendWeeklyDigests(now = new Date()): Promise<{ eligible: number; sent: number; failed: number }> {
  const userIds = await listOptedIn("weekly_digest")
  let sent = 0
  let failed = 0

  for (const userId of userIds) {
    try {
      const data = await getDigestData(userId)
      if (!data) continue
      const ok = await sendOptionalEmail({
        userId,
        category: "weekly_digest",
        dedupeKey: weekKey(now),
        render: (unsubscribeUrl) => weeklyDigestEmail(data, unsubscribeUrl),
      })
      if (ok) sent += 1
    } catch (err) {
      failed += 1
      console.error("[email/weekly-digest] failed for a user:", err instanceof Error ? err.message : err)
    }
  }
  return { eligible: userIds.length, sent, failed }
}
