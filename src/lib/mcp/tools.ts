import { and, asc, desc, eq, gt, gte, ilike, inArray, isNotNull, lte, or, type SQL } from "drizzle-orm"
import { db } from "@/lib/db"
import { applicationAuditEvents, applicationStatusEvents, applications, jobsCache } from "@/lib/db/schema"
import { applyAuditedChangesForUser } from "@/lib/applications/audit"
import {
  ACTIVE_APPLICATION_STATUSES,
  getApplicationStatusTransition,
  type ApplicationStatusIntent,
} from "@/lib/applications/status-transitions"
import { updateApplicationStatusForUser } from "@/lib/jobs/persist-job"
import { FOLLOW_UP_STATUSES } from "@/lib/telegram/digest"
import type { ApplicationStatus } from "@/lib/supabase/database.types"

/**
 * The agent-facing operations. Every function takes the token owner's userId first and puts it in every
 * query's WHERE clause; nothing here reads or writes another user's rows. There are deliberately no delete,
 * billing or AI-credit operations.
 */

export const MCP_SOURCE = "mcp"

export type ToolOutcome = { data: Record<string, unknown> } | { error: string }

const NOT_FOUND: ToolOutcome = { error: "Application not found." }
const MAX_NOTES_CHARS = 8000
const DAY_MS = 24 * 60 * 60 * 1000

const iso = (value: Date | null | undefined) => value?.toISOString() ?? null

const summaryColumns = {
  id: applications.id,
  slug: applications.slug,
  status: applications.status,
  appliedAt: applications.appliedAt,
  lastStatusUpdate: applications.lastStatusUpdate,
  followUpDueAt: applications.followUpDueAt,
  interviewAt: applications.interviewAt,
  customTitle: applications.customTitle,
  customCompany: applications.customCompany,
  jobTitle: jobsCache.title,
  jobCompany: jobsCache.company,
}

function toSummary(row: {
  id: string
  slug: string
  status: ApplicationStatus | null
  appliedAt: Date | null
  lastStatusUpdate: Date | null
  followUpDueAt: Date | null
  interviewAt: Date | null
  customTitle: string | null
  customCompany: string | null
  jobTitle: string | null
  jobCompany: string | null
}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.customTitle ?? row.jobTitle ?? "Untitled role",
    company: row.customCompany ?? row.jobCompany ?? "Unknown company",
    status: row.status ?? "saved",
    applied_at: iso(row.appliedAt),
    last_status_update: iso(row.lastStatusUpdate),
    follow_up_due_at: iso(row.followUpDueAt),
    interview_at: iso(row.interviewAt),
  }
}

export function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`)
}

/** Same definition as the follow-up emails and Telegram digest: the date has passed and an employer reply is still pending. */
function overdueFollowUp(now: Date): SQL[] {
  return [
    isNotNull(applications.followUpDueAt),
    lte(applications.followUpDueAt, now),
    inArray(applications.status, [...FOLLOW_UP_STATUSES]),
  ]
}

export async function listApplications(
  userId: string,
  args: { status?: ApplicationStatus; overdueFollowUps?: boolean; search?: string; limit: number },
): Promise<ToolOutcome> {
  const conditions: (SQL | undefined)[] = [eq(applications.userId, userId)]
  if (args.status) conditions.push(eq(applications.status, args.status))
  if (args.overdueFollowUps) conditions.push(...overdueFollowUp(new Date()))
  const search = args.search?.trim()
  if (search) {
    const pattern = `%${escapeLike(search)}%`
    conditions.push(or(
      ilike(applications.customTitle, pattern),
      ilike(applications.customCompany, pattern),
      ilike(jobsCache.title, pattern),
      ilike(jobsCache.company, pattern),
      ilike(applications.notes, pattern),
    ))
  }

  const rows = await db
    .select(summaryColumns)
    .from(applications)
    .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(and(...conditions))
    .orderBy(desc(applications.lastStatusUpdate), desc(applications.id))
    .limit(args.limit)

  return { data: { count: rows.length, applications: rows.map(toSummary) } }
}

async function findApplication(userId: string, applicationId: string) {
  const [row] = await db
    .select({
      ...summaryColumns,
      notes: applications.notes,
      followUpNotes: applications.followUpNotes,
      followUpCount: applications.followUpCount,
      source: applications.source,
      postingUrl: jobsCache.url,
    })
    .from(applications)
    .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    .limit(1)
  return row
}

export async function getApplication(userId: string, applicationId: string): Promise<ToolOutcome> {
  const row = await findApplication(userId, applicationId)
  if (!row) return NOT_FOUND

  const [statusEvents, activity] = await Promise.all([
    db
      .select({
        fromStatus: applicationStatusEvents.fromStatus,
        toStatus: applicationStatusEvents.toStatus,
        createdAt: applicationStatusEvents.createdAt,
      })
      .from(applicationStatusEvents)
      .where(and(eq(applicationStatusEvents.userId, userId), eq(applicationStatusEvents.applicationId, applicationId)))
      .orderBy(asc(applicationStatusEvents.createdAt)),
    db
      .select({
        eventType: applicationAuditEvents.eventType,
        metadata: applicationAuditEvents.metadata,
        createdAt: applicationAuditEvents.createdAt,
      })
      .from(applicationAuditEvents)
      .where(and(eq(applicationAuditEvents.userId, userId), eq(applicationAuditEvents.applicationId, applicationId)))
      .orderBy(desc(applicationAuditEvents.createdAt))
      .limit(20),
  ])

  const notes = row.notes ?? ""
  return {
    data: {
      ...toSummary(row),
      posting_url: row.postingUrl ?? null,
      source: row.source ?? null,
      notes: notes.slice(0, MAX_NOTES_CHARS),
      notes_truncated: notes.length > MAX_NOTES_CHARS,
      follow_up_note: row.followUpNotes ?? null,
      follow_up_count: row.followUpCount ?? 0,
      status_history: statusEvents.map((event) => ({
        from: event.fromStatus,
        to: event.toStatus,
        at: event.createdAt.toISOString(),
      })),
      recent_activity: activity.map((event) => ({
        type: event.eventType,
        at: event.createdAt.toISOString(),
        details: event.metadata,
      })),
    },
  }
}

export async function updateApplicationStatus(
  userId: string,
  applicationId: string,
  status: ApplicationStatus,
  intent: ApplicationStatusIntent,
): Promise<ToolOutcome> {
  const current = await findApplication(userId, applicationId)
  if (!current) return NOT_FOUND

  const from = current.status ?? "saved"
  const path = getApplicationStatusTransition(from, status, intent)
  if (!path) {
    return {
      error: `Cannot move from "${from}" to "${status}" with intent "${intent}". `
        + `Use intent "progress" to move forward or to an outcome, "correction" to move back or between outcomes, and "reopen" to reopen a closed application.`,
    }
  }
  if (path.length === 0) {
    return { data: { id: applicationId, changed: false, before: { status: from }, after: { status: from } } }
  }

  if (!(await updateApplicationStatusForUser(userId, applicationId, status, intent, MCP_SOURCE))) {
    return { error: "The status could not be changed. Re-read the application and try again." }
  }
  const updated = await findApplication(userId, applicationId)
  return {
    data: {
      id: applicationId,
      changed: true,
      before: { status: from, applied_at: iso(current.appliedAt) },
      after: { status: updated?.status ?? status, applied_at: iso(updated?.appliedAt) },
      steps: path,
      to_undo: `Call update_application_status with status "${from}" and intent "correction".`,
    },
  }
}

export async function setFollowUp(
  userId: string,
  applicationId: string,
  args: { dueAt?: string | null; note?: string | null },
): Promise<ToolOutcome> {
  if (args.dueAt === undefined && args.note === undefined) return { error: "Provide follow_up_due_at, note, or both." }

  const result = await applyAuditedChangesForUser(
    userId,
    applicationId,
    {
      ...(args.dueAt !== undefined ? { followUpDueAt: args.dueAt ? new Date(args.dueAt) : null } : {}),
      ...(args.note !== undefined ? { followUpNotes: args.note } : {}),
    },
    "application.follow_up_updated",
    MCP_SOURCE,
  )
  if (!result) return NOT_FOUND
  const view = (row: { followUpDueAt: Date | null; followUpNotes: string | null }) => ({
    follow_up_due_at: iso(row.followUpDueAt),
    follow_up_note: row.followUpNotes ?? null,
  })
  return { data: { id: applicationId, changed: result.changed, before: view(result.before), after: view(result.after) } }
}

export async function setInterviewTime(userId: string, applicationId: string, interviewAt: string | null): Promise<ToolOutcome> {
  const result = await applyAuditedChangesForUser(
    userId,
    applicationId,
    { interviewAt: interviewAt ? new Date(interviewAt) : null },
    "application.interview_time_updated",
    MCP_SOURCE,
  )
  if (!result) return NOT_FOUND
  return {
    data: {
      id: applicationId,
      changed: result.changed,
      before: { interview_at: iso(result.before.interviewAt) },
      after: { interview_at: iso(result.after.interviewAt) },
    },
  }
}

/** Appends a dated entry. The text is added inside the row lock, so a note typed in the web app at the same moment is not lost. */
export async function addNote(userId: string, applicationId: string, note: string, now = new Date()): Promise<ToolOutcome> {
  const entry = `[${now.toISOString().slice(0, 10)} via AI agent] ${note.trim()}`
  const result = await applyAuditedChangesForUser(
    userId,
    applicationId,
    (current) => ({ notes: current.notes ? `${current.notes}\n\n${entry}` : entry }),
    "application.notes_updated",
    MCP_SOURCE,
  )
  if (!result) return NOT_FOUND
  return {
    data: {
      id: applicationId,
      changed: result.changed,
      added: entry,
      before: { notes_length: result.before.notes?.length ?? 0 },
      after: { notes_length: result.after.notes?.length ?? 0 },
      to_undo: "Notes are append-only here: remove the added entry from the notes in the JobClock web app.",
    },
  }
}

export async function listDue(userId: string, days: number, now = new Date()): Promise<ToolOutcome> {
  const horizon = new Date(now.getTime() + days * DAY_MS)
  const rows = (...conditions: (SQL | undefined)[]) =>
    db
      .select(summaryColumns)
      .from(applications)
      .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
      .where(and(eq(applications.userId, userId), ...conditions))

  const [overdue, upcoming, interviews] = await Promise.all([
    rows(...overdueFollowUp(now)).orderBy(asc(applications.followUpDueAt)).limit(50),
    rows(
      gt(applications.followUpDueAt, now),
      lte(applications.followUpDueAt, horizon),
      inArray(applications.status, [...FOLLOW_UP_STATUSES]),
    ).orderBy(asc(applications.followUpDueAt)).limit(50),
    rows(
      gte(applications.interviewAt, now),
      lte(applications.interviewAt, horizon),
      inArray(applications.status, [...ACTIVE_APPLICATION_STATUSES]),
    ).orderBy(asc(applications.interviewAt)).limit(50),
  ])

  return {
    data: {
      as_of: now.toISOString(),
      days,
      overdue_follow_ups: overdue.map(toSummary),
      upcoming_follow_ups: upcoming.map(toSummary),
      upcoming_interviews: interviews.map(toSummary),
    },
  }
}
