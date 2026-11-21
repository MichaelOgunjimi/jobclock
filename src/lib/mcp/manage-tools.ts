import { and, eq, gte, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { applicationAuditEvents } from "@/lib/db/schema"
import { deleteApplicationWithAuditForUser } from "@/lib/applications/audit"
import {
  archiveApplicationForUser,
  restoreApplicationForUser,
  setApplicationAppliedAtForUser,
  setApplicationSourceForUser,
  setApplicationTagsForUser,
  type ManageResult,
} from "@/lib/applications/manage"
import { currentConnection } from "./connection-context"
import { DEFAULT_DAILY_DELETE_CAP, limitMessage } from "./limits"
import { DAY_MS, findApplication, iso, MCP_SOURCE, NOT_FOUND, toSummary, type ToolOutcome } from "./tools"

/**
 * Archive, restore, tags, source, applied date and (behind its own scope) permanent delete. The first five reuse the
 * audited helpers the web app uses, so validation and audit events are identical; the source is always "mcp".
 */

type Row = { archivedAt: Date | null; tags: string[] | null; source: string | null; appliedAt: Date | null }

function result(applicationId: string, outcome: ManageResult, view: (row: Row) => Record<string, unknown>, toUndo?: (changed: boolean) => string | undefined): ToolOutcome {
  if (outcome === null) return NOT_FOUND
  if ("error" in outcome) return { error: outcome.error }
  const to_undo = toUndo?.(outcome.changed)
  return { data: { id: applicationId, changed: outcome.changed, before: view(outcome.before), after: view(outcome.after), ...(to_undo ? { to_undo } : {}) } }
}

const archiveView = (row: Row) => ({ archived: row.archivedAt !== null, archived_at: iso(row.archivedAt) })

export async function archiveApplication(userId: string, applicationId: string): Promise<ToolOutcome> {
  return result(applicationId, await archiveApplicationForUser(userId, applicationId, MCP_SOURCE), archiveView,
    (changed) => (changed ? "Call restore_application, or undo_last_change." : undefined))
}

export async function restoreApplication(userId: string, applicationId: string): Promise<ToolOutcome> {
  return result(applicationId, await restoreApplicationForUser(userId, applicationId, MCP_SOURCE), archiveView,
    (changed) => (changed ? "Call archive_application, or undo_last_change." : undefined))
}

export async function setTags(userId: string, applicationId: string, tags: string[]): Promise<ToolOutcome> {
  return result(applicationId, await setApplicationTagsForUser(userId, applicationId, tags, MCP_SOURCE), (row) => ({ tags: row.tags ?? [] }),
    (changed) => (changed ? "Call set_tags with the before list, or undo_last_change." : undefined))
}

export async function setSource(userId: string, applicationId: string, source: string | null): Promise<ToolOutcome> {
  return result(applicationId, await setApplicationSourceForUser(userId, applicationId, source, MCP_SOURCE), (row) => ({ source: row.source ?? null }),
    (changed) => (changed ? "Call set_source with the before value, or undo_last_change." : undefined))
}

export async function setAppliedAt(userId: string, applicationId: string, date: string | null): Promise<ToolOutcome> {
  return result(applicationId, await setApplicationAppliedAtForUser(userId, applicationId, date, MCP_SOURCE), (row) => ({ applied_at: iso(row.appliedAt) }),
    (changed) => (changed ? "Call set_applied_at with the before date, or undo_last_change." : undefined))
}

// ── Permanent delete (applications:delete) ──────────────────────────────────────────────────────────────────────

const DELETE_WHERE = "Settings -> AI Agent, on this token or connected app (Permanent deletions per day)"

async function deletedBySince(userId: string, since: Date): Promise<number> {
  const connection = currentConnection()
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(applicationAuditEvents)
    .where(and(
      eq(applicationAuditEvents.userId, userId),
      eq(applicationAuditEvents.eventType, "application.deleted"),
      gte(applicationAuditEvents.createdAt, since),
      sql`${applicationAuditEvents.metadata}->>'source' = ${MCP_SOURCE}`,
      connection ? sql`${applicationAuditEvents.metadata}->>'connectionId' = ${connection.id}` : undefined,
    ))
  return row?.count ?? 0
}

/**
 * Hard delete. Four independent safeguards, each refusing before anything is removed: the application must already be
 * archived (so a reversible step always comes first), `confirm_title` must equal the title exactly as shown, the owner's
 * per-connection daily cap must have room, and the connection must be known. The title is compared as shown by
 * get_application / list_applications (the custom title, else the posting's), with no trimming or case folding.
 */
export async function deleteApplication(userId: string, applicationId: string, confirmTitle: string, now = new Date()): Promise<ToolOutcome> {
  const connection = currentConnection()
  const cap = connection?.dailyDeleteCap ?? DEFAULT_DAILY_DELETE_CAP
  const row = await findApplication(userId, applicationId)
  if (!row) return NOT_FOUND

  if (!row.archivedAt) {
    return { error: "Not deleted: the application is not archived. Archive it first with archive_application (that step is reversible), then call delete_application again." }
  }
  const title = toSummary(row).title
  if (confirmTitle !== title) {
    return { error: "Not deleted: confirm_title does not match this application's title. Read it with get_application and pass it exactly as shown (same spelling, spacing and capitals). This check makes sure the id is the one you mean." }
  }
  if (cap === 0) {
    return { error: limitMessage("Not deleted: deleting is switched off for this connection (its permanent-deletion limit is 0)", "The owner decides whether an agent may delete anything.", `The owner can raise it in JobClock under ${DELETE_WHERE}.`) }
  }
  const deletedToday = await deletedBySince(userId, new Date(now.getTime() - DAY_MS))
  if (deletedToday >= cap) {
    return {
      error: limitMessage(
        `Daily deletion limit reached: this connection has already permanently deleted ${deletedToday} applications in the last 24 hours (its limit is ${cap})`,
        "The limit stops an agent that loops, or one that was fed malicious text, from emptying the owner's list.",
        `The owner can change it in JobClock under ${DELETE_WHERE}.`,
      ),
    }
  }

  // Re-checks "archived" under the row lock and records only who, never the application's text.
  const deleted = await deleteApplicationWithAuditForUser(userId, applicationId, { source: MCP_SOURCE, omitText: true, requireArchived: true })
  if (!deleted) return { error: "Not deleted: the application changed while it was being deleted (it may have been restored). Read it again and retry if the owner really wants it deleted." }
  return {
    data: {
      id: applicationId,
      deleted: true,
      permanent: true,
      undoable: false,
      note: "PERMANENT: the application, its notes, status history, company research and interview prep are gone and cannot be restored or undone (cover letters and tailored CVs stay in the owner's library, no longer linked to it). The audit trail records only that this connection deleted it, not its text.",
      deleted_by_this_connection_in_24h: deletedToday + 1,
      daily_limit: cap,
    },
  }
}
