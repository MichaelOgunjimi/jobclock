import { count, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications } from "@/lib/db/schema"

const DAY_MS = 86_400_000
/** Statuses that mean an employer replied (as opposed to still waiting or no answer). */
const REPLIED = ["screening", "interview", "offer", "rejected"]

export interface ApplicationStats {
  byStatus: Record<string, number>
  savedThisWeek: number
  appliedThisWeek: number
}

const BAR_WIDTH = 10
const STATUS_ROWS = ["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn", "ghosted"]

function bar(value: number, max: number): string {
  const filled = value === 0 ? 0 : Math.max(1, Math.round((value / max) * BAR_WIDTH))
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled)
}

/** Renders stats as the /stats reply (Telegram HTML: send with sendTelegramHtml). */
export function formatStats({ byStatus, savedThisWeek, appliedThisWeek }: ApplicationStats): string {
  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0)
  if (total === 0) return "No saved jobs yet. Send me a job link to add one."

  const n = (status: string) => byStatus[status] ?? 0
  const submitted = total - n("saved")
  const replied = REPLIED.reduce((sum, status) => sum + n(status), 0)
  const max = Math.max(...STATUS_ROWS.map(n))
  const rows = STATUS_ROWS.map(
    (status) => `${status.padEnd(9)} ${String(n(status)).padStart(3)} ${bar(n(status), max)}`
  ).join("\n")
  const rate = submitted > 0
    ? `🎯 <b>Response rate: ${Math.round((replied / submitted) * 100)}%</b>\n<i>${replied} of ${submitted} applications got a reply</i>`
    : "🎯 <i>No applications sent yet</i>"

  return [
    "📊 <b>Your JobClock stats</b>",
    `<i>${total} application${total === 1 ? "" : "s"} tracked</i>`,
    "",
    `<pre>${rows}</pre>`,
    "",
    `🗓 <b>This week</b>\n📌 Saved ${savedThisWeek}  ·  📨 Applied ${appliedThisWeek}`,
    "",
    rate,
  ].join("\n")
}

/** Counts a user's applications by status plus the last 7 days of activity. */
export async function getApplicationStats(userId: string): Promise<ApplicationStats> {
  const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString()
  const [rows, [week]] = await Promise.all([
    db
      .select({ status: applications.status, total: count() })
      .from(applications)
      .where(eq(applications.userId, userId))
      .groupBy(applications.status),
    db
      .select({
        saved: sql<number>`count(*) filter (where ${applications.createdAt} >= ${weekAgo}::timestamptz)`.mapWith(Number),
        applied: sql<number>`count(*) filter (where ${applications.appliedAt} >= ${weekAgo}::timestamptz)`.mapWith(Number),
      })
      .from(applications)
      .where(eq(applications.userId, userId)),
  ])

  return {
    byStatus: Object.fromEntries(rows.map((row) => [row.status ?? "saved", row.total])),
    savedThisWeek: week?.saved ?? 0,
    appliedThisWeek: week?.applied ?? 0,
  }
}
