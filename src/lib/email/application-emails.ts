import { and, asc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications, emailPreferences, jobsCache, profiles } from "@/lib/db/schema"
import { DEADLINE_WINDOW_DAYS, STALE_AFTER_DAYS, STALE_STATUSES } from "@/lib/applications/attention"
import { getAppUrl } from "@/lib/site"
import { addDaysToDate, formatLocalDate, startOfLocalDay } from "@/lib/timezone"
import { FOLLOW_UP_STATUSES, type FollowUpItem } from "@/lib/telegram/digest"
import type { EmailCategory } from "./categories"
import { sendOptionalEmail } from "./optional"
import { sentKeys } from "./sent-log"
import { deadlineEmail, followUpDueEmail, interviewEmail, staleApplicationEmail, type RenderedEmail } from "./templates"

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
      timezone: profiles.timezone,
      title: jobsCache.title,
      company: jobsCache.company,
      customTitle: applications.customTitle,
      customCompany: applications.customCompany,
    })
    .from(applications)
    .innerJoin(emailPreferences, and(eq(emailPreferences.userId, applications.userId), eq(emailPreferences.followUpReminders, true)))
    .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .leftJoin(profiles, eq(profiles.id, applications.userId))
    .where(and(isNull(applications.archivedAt), isNotNull(applications.followUpDueAt), lte(applications.followUpDueAt, now), inArray(applications.status, [...FOLLOW_UP_STATUSES])))
    .orderBy(asc(applications.followUpDueAt))

  return eachUser(byUser(rows), "follow-ups", (userId, userRows) => {
    const items = userRows.map((row) => ({
      // A new due date on the same application is a new reminder.
      key: `app:${row.id}:${row.dueAt!.toISOString()}`,
      title: row.customTitle ?? row.title ?? "Untitled role",
      company: row.customCompany ?? row.company ?? "Unknown company",
      dueAt: row.dueAt!.toISOString(),
      timezone: row.timezone,
      url: applicationUrl(row.slug),
    }))
    return sendGrouped<FollowUpItem & { key: string }>(userId, "follow_up_reminders", items, now, (fresh, url) => followUpDueEmail(fresh, url))
  })
}

/**
 * Deadline reminders: saved jobs whose apply_deadline is one or two days away on the recipient's own calendar. One email per job,
 * ever; a missed cron day still catches up. The deadline is a plain date, so "today" is the user's local date, not the UTC one
 * (08:00 UTC is still the previous evening in Hawaii and Alaska).
 */
export async function sendDeadlineReminders(now = new Date()): Promise<JobRunResult> {
  const rows = (await db
    .select({
      userId: applications.userId,
      jobId: jobsCache.id,
      slug: applications.slug,
      deadline: jobsCache.applyDeadline,
      timezone: profiles.timezone,
      title: jobsCache.title,
      company: jobsCache.company,
      customTitle: applications.customTitle,
      customCompany: applications.customCompany,
    })
    .from(applications)
    .innerJoin(emailPreferences, and(eq(emailPreferences.userId, applications.userId), eq(emailPreferences.deadlineReminders, true)))
    .innerJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .leftJoin(profiles, eq(profiles.id, applications.userId))
    // Coarse UTC-date bounds that contain every zone's window; the exact local-date cut is made below.
    .where(and(isNull(applications.archivedAt), eq(applications.status, "saved"), gt(jobsCache.applyDeadline, dayKey(new Date(now.getTime() - DAY_MS))), lte(jobsCache.applyDeadline, dayKey(new Date(now.getTime() + (DEADLINE_WINDOW_DAYS + 1) * DAY_MS)))))
    .orderBy(asc(jobsCache.applyDeadline))).filter((row) => {
    const today = formatLocalDate(now, row.timezone)
    return row.deadline! > today && row.deadline! <= addDaysToDate(today, DEADLINE_WINDOW_DAYS)
  })

  return eachUser(byUser(rows), "deadlines", async (userId, userRows) => {
    let sent = 0
    for (const row of userRows) {
      const deadline = row.deadline!
      const item = {
        title: row.customTitle ?? row.title,
        company: row.customCompany ?? row.company,
        deadline,
        daysLeft: Math.round((Date.parse(deadline) - Date.parse(formatLocalDate(now, row.timezone))) / DAY_MS),
        url: applicationUrl(row.slug),
      }
      if (await sendOptionalEmail({ userId, category: "deadline_reminders", dedupeKey: `job:${row.jobId}`, render: (url) => deadlineEmail(item, url) })) sent += 1
    }
    return sent
  })
}

/**
 * The interviews a daily run reminds about, in the user's zone: from the end of the day the previous run (24h ago) called
 * "tomorrow" to the end of the day this run calls "tomorrow". On an ordinary day that is exactly the local tomorrow. Runs are
 * exactly 24h apart, so these windows tile: an interview lands in one run's window, never two, and never in a gap, even on a
 * DST day where the 08:00 UTC run's local date repeats or skips (Alaska). The dedupe key stays as a belt-and-braces guard.
 */
export function interviewWindow(now: Date, timezone?: string | null): { from: Date; to: Date } {
  const end = (at: Date) => startOfLocalDay(addDaysToDate(formatLocalDate(at, timezone), 2), timezone)
  return { from: end(new Date(now.getTime() - DAY_MS)), to: end(now) }
}

/** Interview reminders: interviews on tomorrow in the recipient's own timezone, one email per interview. Needs applications.interview_at. */
export async function sendInterviewReminders(now = new Date()): Promise<JobRunResult> {
  const rows = (await db
    .select({
      userId: applications.userId,
      id: applications.id,
      slug: applications.slug,
      interviewAt: applications.interviewAt,
      timezone: profiles.timezone,
      title: jobsCache.title,
      company: jobsCache.company,
      customTitle: applications.customTitle,
      customCompany: applications.customCompany,
    })
    .from(applications)
    .innerJoin(emailPreferences, and(eq(emailPreferences.userId, applications.userId), eq(emailPreferences.interviewReminders, true)))
    .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .leftJoin(profiles, eq(profiles.id, applications.userId))
    // Coarse UTC bounds that contain every zone's window (UTC-12 to UTC+14); the exact local-day cut is made below.
    .where(and(isNull(applications.archivedAt), gte(applications.interviewAt, new Date(now.getTime() - DAY_MS)), lt(applications.interviewAt, new Date(now.getTime() + 3 * DAY_MS)), inArray(applications.status, [...FOLLOW_UP_STATUSES])))
    .orderBy(asc(applications.interviewAt))).filter((row) => {
    const { from, to } = interviewWindow(now, row.timezone)
    return row.interviewAt! >= from && row.interviewAt! < to
  })

  return eachUser(byUser(rows), "interviews", async (userId, userRows) => {
    let sent = 0
    for (const row of userRows) {
      const item = {
        title: row.customTitle ?? row.title ?? "Untitled role",
        company: row.customCompany ?? row.company ?? "Unknown company",
        interviewAt: row.interviewAt!.toISOString(),
        timezone: row.timezone,
        url: applicationUrl(row.slug),
      }
      // A rescheduled interview has a new time, so it gets its own reminder.
      const dedupeKey = `app:${row.id}:${item.interviewAt}`
      if (await sendOptionalEmail({ userId, category: "interview_reminders", dedupeKey, render: (url) => interviewEmail(item, url) })) sent += 1
    }
    return sent
  })
}

/** Stale nudges: applied or screening applications with no status change for 21 days. Each application is nudged once, ever. */
export async function sendStaleApplicationNudges(now = new Date()): Promise<JobRunResult> {
  const rows = await db
    .select({
      userId: applications.userId,
      id: applications.id,
      slug: applications.slug,
      changedAt: applications.lastStatusUpdate,
      title: jobsCache.title,
      company: jobsCache.company,
      customTitle: applications.customTitle,
      customCompany: applications.customCompany,
    })
    .from(applications)
    .innerJoin(emailPreferences, and(eq(emailPreferences.userId, applications.userId), eq(emailPreferences.staleApplicationNudges, true)))
    .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(and(isNull(applications.archivedAt), inArray(applications.status, [...STALE_STATUSES]), lte(applications.lastStatusUpdate, new Date(now.getTime() - STALE_AFTER_DAYS * DAY_MS))))
    .orderBy(asc(applications.lastStatusUpdate))

  return eachUser(byUser(rows), "stale-applications", (userId, userRows) => {
    const items = userRows.map((row) => ({
      key: `app:${row.id}`,
      title: row.customTitle ?? row.title ?? "Untitled role",
      company: row.customCompany ?? row.company ?? "Unknown company",
      days: Math.floor((now.getTime() - row.changedAt!.getTime()) / DAY_MS),
      url: applicationUrl(row.slug),
    }))
    return sendGrouped(userId, "stale_application_nudges", items, now, (fresh, url) => staleApplicationEmail(fresh, url))
  })
}
