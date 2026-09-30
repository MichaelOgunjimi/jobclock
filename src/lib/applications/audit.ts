import { and, desc, eq, type InferInsertModel, type InferSelectModel } from "drizzle-orm"
import { db } from "@/lib/db"
import { applicationAuditEvents, applications } from "@/lib/db/schema"
import type { Json } from "@/lib/supabase/database.types"

export type ApplicationAuditEventType =
  | "application.created"
  | "application.deleted"
  | "application.details_updated"
  | "application.description_updated"
  | "application.notes_updated"
  | "application.status_changed"
  | "application.cv_selected"
  | "application.cv_generated"
  | "application.cv_edited"
  | "application.cover_letter_selected"
  | "application.cover_letter_generated"
  | "application.cover_letter_edited"
  | "application.writing_style_updated"
  | "application.follow_up_updated"
  | "application.interview_prep_generated"
  | "application.company_research_generated"
  | "application.interview_question_added"
  | "application.interview_answer_generated"
  | "application.interview_answer_saved"

export interface ApplicationAuditEventInput {
  applicationId: string
  userId: string
  eventType: ApplicationAuditEventType
  metadata?: Record<string, Json | undefined>
  createdAt?: Date
}

type AuditExecutor = Pick<typeof db, "insert">

export async function appendApplicationAuditEvents(
  executor: AuditExecutor,
  input: ApplicationAuditEventInput | ApplicationAuditEventInput[],
) {
  const events = Array.isArray(input) ? input : [input]
  if (events.length === 0) return
  await executor.insert(applicationAuditEvents).values(
    events.map((event) => ({
      ...event,
      metadata: event.metadata ?? {},
    })),
  )
}

type Application = InferSelectModel<typeof applications>
type ApplicationUpdate = InferInsertModel<typeof applications>
export type AuditedApplicationChanges = Partial<Pick<
  ApplicationUpdate,
  | "customTitle"
  | "customCompany"
  | "customLocation"
  | "customSalaryText"
  | "customDescription"
  | "notes"
  | "selectedCvId"
  | "coverLetterId"
  | "structureId"
  | "coverLetterTone"
  | "followUpDueAt"
  | "followUpNotes"
>>

const CONTENT_FIELDS = new Set<keyof AuditedApplicationChanges>([
  "customDescription",
  "notes",
  "followUpNotes",
])

function safeValue(field: keyof AuditedApplicationChanges, value: unknown): Json {
  if (CONTENT_FIELDS.has(field)) {
    const text = typeof value === "string" ? value : ""
    return { present: text.length > 0, characters: text.length }
  }
  if (value instanceof Date) return value.toISOString()
  return (value ?? null) as Json
}

function equalValues(before: unknown, after: unknown) {
  const left = before instanceof Date ? before.toISOString() : before ?? null
  const right = after instanceof Date ? after.toISOString() : after ?? null
  return left === right
}

export async function updateApplicationWithAuditForUser(
  userId: string,
  applicationId: string,
  changes: AuditedApplicationChanges,
  eventType: ApplicationAuditEventType,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1)
      .for("update")

    if (!current) return false

    const changedFields = Object.entries(changes).filter(
      ([field, value]) => !equalValues(current[field as keyof Application], value),
    ) as [keyof AuditedApplicationChanges, unknown][]
    if (changedFields.length === 0) return true

    await tx
      .update(applications)
      .set(changes)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))

    await appendApplicationAuditEvents(tx, {
      applicationId,
      userId,
      eventType,
      metadata: {
        changes: Object.fromEntries(changedFields.map(([field, after]) => [
          field,
          {
            before: safeValue(field, current[field as keyof Application]),
            after: safeValue(field, after),
          },
        ])),
      },
    })
    return true
  })
}

export async function deleteApplicationWithAuditForUser(
  userId: string,
  applicationId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [application] = await tx
      .select({
        slug: applications.slug,
        title: applications.customTitle,
        company: applications.customCompany,
      })
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1)
      .for("update")

    if (!application) return false

    await appendApplicationAuditEvents(tx, {
      applicationId,
      userId,
      eventType: "application.deleted",
      metadata: {
        slug: application.slug,
        title: application.title,
        company: application.company,
      },
    })
    await tx
      .delete(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    return true
  })
}

export async function listApplicationAuditForUser(userId: string, applicationId: string) {
  return db
    .select({
      id: applicationAuditEvents.id,
      eventType: applicationAuditEvents.eventType,
      metadata: applicationAuditEvents.metadata,
      createdAt: applicationAuditEvents.createdAt,
    })
    .from(applicationAuditEvents)
    .where(and(
      eq(applicationAuditEvents.userId, userId),
      eq(applicationAuditEvents.applicationId, applicationId),
    ))
    .orderBy(desc(applicationAuditEvents.createdAt), desc(applicationAuditEvents.id))
}
