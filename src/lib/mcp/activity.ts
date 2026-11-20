import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { applicationAuditEvents, applications, jobsCache } from "@/lib/db/schema"

export interface ConnectionActivityItem {
  id: string
  /** The MCP tool that made the change. add_applications records one event per job, so it shows as add_application. */
  tool: string
  /** e.g. "saved -> applied". */
  detail: string | null
  applicationSlug: string | null
  applicationTitle: string | null
  at: string
}

const TOOLS: Record<string, string> = {
  "application.created": "add_application",
  "application.status_changed": "update_application_status",
  "application.follow_up_updated": "set_follow_up",
  "application.interview_time_updated": "set_interview_time",
  "application.notes_updated": "add_note",
}

/** How many of the newest MCP changes are read to fill every connection's list. */
const SCAN = 300

/**
 * The last `perConnection` changes each token or connected app made, keyed by connection id. Only changes are recorded
 * (a read leaves no trace), and only for events written since the connection id started being recorded. Always the
 * owner's own events: the query is bound to `userId`.
 */
export async function listConnectionActivity(userId: string, perConnection = 10): Promise<Record<string, ConnectionActivityItem[]>> {
  const rows = await db
    .select({
      id: applicationAuditEvents.id,
      eventType: applicationAuditEvents.eventType,
      metadata: applicationAuditEvents.metadata,
      createdAt: applicationAuditEvents.createdAt,
      slug: applications.slug,
      customTitle: applications.customTitle,
      jobTitle: jobsCache.title,
    })
    .from(applicationAuditEvents)
    .leftJoin(applications, and(eq(applications.id, applicationAuditEvents.applicationId), eq(applications.userId, userId)))
    .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(and(eq(applicationAuditEvents.userId, userId), sql`${applicationAuditEvents.metadata}->>'connectionId' is not null`))
    .orderBy(desc(applicationAuditEvents.createdAt), desc(applicationAuditEvents.id))
    .limit(SCAN)

  const byConnection: Record<string, ConnectionActivityItem[]> = {}
  for (const row of rows) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    const connectionId = String(metadata.connectionId)
    const list = (byConnection[connectionId] ??= [])
    if (list.length >= perConnection) continue
    list.push({
      id: row.id,
      tool: TOOLS[row.eventType] ?? row.eventType,
      detail: row.eventType === "application.status_changed" && metadata.fromStatus && metadata.toStatus ? `${metadata.fromStatus} -> ${metadata.toStatus}` : null,
      applicationSlug: row.slug,
      applicationTitle: row.customTitle ?? row.jobTitle ?? null,
      at: row.createdAt.toISOString(),
    })
  }
  return byConnection
}
