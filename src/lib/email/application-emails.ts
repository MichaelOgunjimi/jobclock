import { and, asc, eq, inArray, isNotNull, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications, emailPreferences, jobsCache } from "@/lib/db/schema"
import { getAppUrl } from "@/lib/site"
import { FOLLOW_UP_STATUSES, type FollowUpItem } from "@/lib/telegram/digest"
import type { EmailCategory } from "./categories"
import { sendOptionalEmail } from "./optional"
import { sentKeys } from "./sent-log"
import { followUpDueEmail, type RenderedEmail } from "./templates"

export interface JobRunResult {
  eligible: number
  sent: number
  failed: number
}

const dayKey = (now: Date) => now.toISOString().slice(0, 10)
const applicationUrl = (slug: string) => `${getAppUrl()}/applications/${slug}`

/** Groups rows by user, keeping each user's rows in query order. */
function byUser<T extends { userId: string }>(rows: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const row of rows) groups.set(row.userId, [...(groups.get(row.userId) ?? []), row])
  return groups
}

/** Runs one send per user and counts the results; one user's failure never stops the rest. */
async function eachUser<T>(groups: Map<string, T[]>, label: string, send: (userId: string, rows: T[]) => Promise<boolean>): Promise<JobRunResult> {
  let sent = 0
  let failed = 0
  for (const [userId, rows] of groups) {
    try {
      if (await send(userId, rows)) sent += 1
    } catch (err) {
      failed += 1
      console.error(`[email/${label}] failed for a user:`, err instanceof Error ? err.message : err)
    }
  }
  return { eligible: groups.size, sent, failed }
}

/**
 * One email per user per day listing everything new, and each item is listed once: its key is recorded when the
 * email goes out, so a long-overdue application does not come back every morning.
 */
async function sendGrouped<T extends { key: string }>(
  userId: string,
  category: EmailCategory,
  items: T[],
  now: Date,
  render: (fresh: T[], unsubscribeUrl: string) => RenderedEmail,
): Promise<boolean> {
  const done = await sentKeys(userId, category, items.map((item) => item.key))
  const fresh = items.filter((item) => !done.has(item.key))
  if (fresh.length === 0) return false
  return sendOptionalEmail({
    userId,
    category,
    dedupeKey: `day:${dayKey(now)}`,
    recordKeys: fresh.map((item) => item.key),
    render: (unsubscribeUrl) => render(fresh, unsubscribeUrl),
  })
}

/** Follow-up reminders: applications whose follow-up date has passed and that still wait on an employer reply. */
export async function sendFollowUpReminders(now = new Date()): Promise<JobRunResult> {
  const rows = await db
    .select({
      userId: applications.userId,
      id: applications.id,
      slug: applications.slug,
      dueAt: applications.followUpDueAt,
      title: jobsCache.title,
      company: jobsCache.company,
      customTitle: applications.customTitle,
      customCompany: applications.customCompany,
    })
    .from(applications)
    .innerJoin(emailPreferences, and(eq(emailPreferences.userId, applications.userId), eq(emailPreferences.followUpReminders, true)))
    .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(and(isNotNull(applications.followUpDueAt), lte(applications.followUpDueAt, now), inArray(applications.status, [...FOLLOW_UP_STATUSES])))
    .orderBy(asc(applications.followUpDueAt))

  return eachUser(byUser(rows), "follow-ups", (userId, userRows) => {
    const items = userRows.map((row) => ({
      // A new due date on the same application is a new reminder.
      key: `app:${row.id}:${row.dueAt!.toISOString()}`,
      title: row.customTitle ?? row.title ?? "Untitled role",
      company: row.customCompany ?? row.company ?? "Unknown company",
      dueAt: row.dueAt!.toISOString(),
      url: applicationUrl(row.slug),
    }))
    return sendGrouped<FollowUpItem & { key: string }>(userId, "follow_up_reminders", items, now, (fresh, url) => followUpDueEmail(fresh, url))
  })
}
