import { applyAuditedChangesForUser, type AuditedChangeResult } from "./audit"
import { normalizeAppliedAt, normalizeSource, normalizeTags, type Validated } from "./details"

/**
 * Owner-facing application management, shared by the web app and (later) the MCP tools. Each helper is user-scoped,
 * locks the row, validates, writes one audit event with before/after, and returns the row before and after.
 * `null` means the user has no such application; `{ error }` means the value was rejected and nothing changed.
 * `source` marks who made the change (e.g. "mcp") in the audit event.
 */
export type ManageResult = AuditedChangeResult | { error: string } | null

function failed(result: Validated<unknown>): result is { ok: false; error: string } {
  return !result.ok
}

/** Hides the application from the default list and every reminder. The status is not touched. Archiving twice is a no-op. */
export function archiveApplicationForUser(userId: string, applicationId: string, source?: string) {
  return applyAuditedChangesForUser(
    userId,
    applicationId,
    (current) => ({ archivedAt: current.archivedAt ?? new Date() }),
    "application.archived",
    source,
  )
}

export function restoreApplicationForUser(userId: string, applicationId: string, source?: string) {
  return applyAuditedChangesForUser(userId, applicationId, { archivedAt: null }, "application.restored", source)
}

export async function setApplicationTagsForUser(
  userId: string,
  applicationId: string,
  tags: readonly string[],
  source?: string,
): Promise<ManageResult> {
  const valid = normalizeTags(tags)
  if (failed(valid)) return { error: valid.error }
  return applyAuditedChangesForUser(userId, applicationId, { tags: valid.value }, "application.tags_updated", source)
}

export async function setApplicationSourceForUser(
  userId: string,
  applicationId: string,
  source: string | null,
  sourceOfChange?: string,
): Promise<ManageResult> {
  const valid = normalizeSource(source)
  if (failed(valid)) return { error: valid.error }
  return applyAuditedChangesForUser(userId, applicationId, { source: valid.value }, "application.source_updated", sourceOfChange)
}

/**
 * `date` is `YYYY-MM-DD`, or null to clear. Status changes only set applied_at when it is empty, so this edit is never
 * overwritten later; resubmitting the date already stored is a no-op rather than moving the time of day.
 */
export async function setApplicationAppliedAtForUser(
  userId: string,
  applicationId: string,
  date: string | null,
  source?: string,
  now = new Date(),
): Promise<ManageResult> {
  const valid = normalizeAppliedAt(date, now)
  if (failed(valid)) return { error: valid.error }
  return applyAuditedChangesForUser(
    userId,
    applicationId,
    (current) => ({
      appliedAt: valid.value && current.appliedAt?.toISOString().slice(0, 10) === date ? current.appliedAt : valid.value,
    }),
    "application.applied_at_updated",
    source,
  )
}
