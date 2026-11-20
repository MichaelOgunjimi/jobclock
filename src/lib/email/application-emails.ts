import { and, asc, eq, gt, gte, inArray, isNotNull, lt, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications, emailPreferences, jobsCache } from "@/lib/db/schema"
import { getAppUrl } from "@/lib/site"
import { FOLLOW_UP_STATUSES, type FollowUpItem } from "@/lib/telegram/digest"
import type { EmailCategory } from "./categories"
import { sendOptionalEmail } from "./optional"
import { sentKeys } from "./sent-log"
import { deadlineEmail, followUpDueEmail, interviewEmail, type RenderedEmail } from "./templates"

export interface JobRunResult {
  eligible: number
  sent: number
  failed: number
}

const DAY_MS = 86_400_000
const dayKey = (now: Date) => now.toISOString().slice(0, 10)
const applicationUrl = (slug: string) => `${getAppUrl()}/applications/${slug}`

/** Groups rows by user, keeping each user's rows in query order. */
function byUser<T extends { userId: string }>(rows: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const row of rows) groups.set(row.userId, [...(groups.get(row.userId) ?? []), row])
  return groups
}

/** Runs the sends for each user and counts the emails that went out; one user's failure never stops the rest. */
async function eachUser<T>(groups: Map<string, T[]>, label: string, send: (userId: string, rows: T[]) => Promise<number>): Promise<JobRunResult> {
  let sent = 0
  let failed = 0
  for (const [userId, rows] of groups) {
    try {
      sent += await send(userId, rows)
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
): Promise<number> {
  const done = await sentKeys(userId, category, items.map((item) => item.key))
  const fresh = items.filter((item) => !done.has(item.key))
  if (fresh.length === 0) return 0
  const sent = await sendOptionalEmail({
    userId,
    category,
    dedupeKey: `day:${dayKey(now)}`,
    recordKeys: fresh.map((item) => item.key),
    render: (unsubscribeUrl) => render(fresh, unsubscribeUrl),
  })
  return sent ? 1 : 0
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

/** Deadline reminders: saved jobs whose apply_deadline is one or two days away. One email per job, ever; a missed cron day still catches up. */
export async function sendDeadlineReminders(now = new Date()): Promise<JobRunResult> {
  const today = dayKey(now)
  const rows = await db
    .select({
      userId: applications.userId,
      jobId: jobsCache.id,
      slug: applications.slug,
      deadline: jobsCache.applyDeadline,
      title: jobsCache.title,
      company: jobsCache.company,
      customTitle: applications.customTitle,
      customCompany: applications.customCompany,
    })
    .from(applications)
    .innerJoin(emailPreferences, and(eq(emailPreferences.userId, applications.userId), eq(emailPreferences.deadlineReminders, true)))
    .innerJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(and(eq(applications.status, "saved"), gt(jobsCache.applyDeadline, today), lte(jobsCache.applyDeadline, dayKey(new Date(now.getTime() + 2 * DAY_MS)))))
    .orderBy(asc(jobsCache.applyDeadline))

  return eachUser(byUser(rows), "deadlines", async (userId, userRows) => {
    let sent = 0
    for (const row of userRows) {
      const deadline = row.deadline!
      const item = {
        title: row.customTitle ?? row.title,
        company: row.customCompany ?? row.company,
        deadline,
        daysLeft: Math.round((Date.parse(deadline) - Date.parse(today)) / DAY_MS),
        url: applicationUrl(row.slug),
      }
      if (await sendOptionalEmail({ userId, category: "deadline_reminders", dedupeKey: `job:${row.jobId}`, render: (url) => deadlineEmail(item, url) })) sent += 1
    }
    return sent
  })
}

/** Interview reminders: interviews that fall on tomorrow (UTC), one email per interview. Needs applications.interview_at, which nothing sets yet. */
export async function sendInterviewReminders(now = new Date()): Promise<JobRunResult> {
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  const dayAfter = new Date(tomorrow.getTime() + DAY_MS)
  const rows = await db
    .select({
      userId: applications.userId,
      id: applications.id,
      slug: applications.slug,
      interviewAt: applications.interviewAt,
      title: jobsCache.title,
      company: jobsCache.company,
      customTitle: applications.customTitle,
      customCompany: applications.customCompany,
    })
    .from(applications)
    .innerJoin(emailPreferences, and(eq(emailPreferences.userId, applications.userId), eq(emailPreferences.interviewReminders, true)))
    .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(and(gte(applications.interviewAt, tomorrow), lt(applications.interviewAt, dayAfter), inArray(applications.status, [...FOLLOW_UP_STATUSES])))
    .orderBy(asc(applications.interviewAt))

  return eachUser(byUser(rows), "interviews", async (userId, userRows) => {
    let sent = 0
    for (const row of userRows) {
      const item = {
        title: row.customTitle ?? row.title ?? "Untitled role",
        company: row.customCompany ?? row.company ?? "Unknown company",
        interviewAt: row.interviewAt!.toISOString(),
        url: applicationUrl(row.slug),
      }
      // A rescheduled interview has a new time, so it gets its own reminder.
      const dedupeKey = `app:${row.id}:${item.interviewAt}`
      if (await sendOptionalEmail({ userId, category: "interview_reminders", dedupeKey, render: (url) => interviewEmail(item, url) })) sent += 1
    }
    return sent
  })
}
