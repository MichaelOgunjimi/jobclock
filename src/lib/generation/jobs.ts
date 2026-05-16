import { and, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { generationJobs } from "@/lib/db/schema"

export type GenerationKind =
  | "cover_letter"
  | "company_research"
  | "interview_prep"
  | "cv_tailor"
  | "interview_answer"

export type GenerationStatus = "queued" | "running" | "done" | "failed"

export interface GenerationJob {
  id: string
  userId: string
  applicationId: string | null
  kind: GenerationKind
  status: GenerationStatus
  resultRef: string | null
  error: string | null
  attempts: number
  params: unknown
  seenAt: Date | null
}

const ACTIVE_STATUSES = ["queued", "running"] as const

export async function findActiveJob(
  applicationId: string,
  kind: GenerationKind,
): Promise<GenerationJob | null> {
  const rows = (await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.applicationId, applicationId),
        eq(generationJobs.kind, kind),
        inArray(generationJobs.status, ACTIVE_STATUSES as unknown as string[]),
      ),
    )) as GenerationJob[]

  return rows[0] ?? null
}

export async function createGenerationJob(input: {
  userId: string
  applicationId: string
  kind: GenerationKind
  params?: unknown
}): Promise<{ job: GenerationJob; deduped: boolean }> {
  const existing = await findActiveJob(input.applicationId, input.kind)

  if (existing) {
    return { job: existing, deduped: true }
  }

  const [job] = (await db
    .insert(generationJobs)
    .values({
      userId: input.userId,
      applicationId: input.applicationId,
      kind: input.kind,
      status: "queued",
      params: input.params ?? null,
    })
    .returning()) as GenerationJob[]

  return { job, deduped: false }
}

async function setJob(jobId: string, fields: Record<string, unknown>): Promise<void> {
  await db
    .update(generationJobs)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(generationJobs.id, jobId))
}

export async function markRunning(jobId: string): Promise<void> {
  await setJob(jobId, { status: "running" })
}

export async function markDone(jobId: string, resultRef: string): Promise<void> {
  await setJob(jobId, { status: "done", resultRef })
}

export async function markFailed(jobId: string, error: string): Promise<void> {
  await setJob(jobId, {
    status: "failed",
    error,
    attempts: sql`${generationJobs.attempts} + 1`,
  })
}

export async function markSeen(jobId: string): Promise<void> {
  await setJob(jobId, { seenAt: new Date() })
}
