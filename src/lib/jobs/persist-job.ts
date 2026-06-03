import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { applicationStatusEvents, applications, jobsCache } from "@/lib/db/schema"
import type { ApplicationStatus } from "@/lib/supabase/database.types"

export interface PersistedJobInput {
  url: string
  source: string
  title: string
  company: string
  location?: string | null
  description?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  postedAt?: string | null
  isEasyApply?: boolean | null
  applyDeadline?: string | null
  isRemote?: boolean | null
  remoteType?: string | null
}

function toTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toNumeric(value: number | null | undefined): string | null {
  if (value == null) return null
  return String(value)
}

export async function findExistingApplicationIdByUrl(userId: string, url: string): Promise<string | null> {
  const [record] = await db
    .select({ applicationId: applications.id })
    .from(applications)
    .innerJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(and(eq(applications.userId, userId), eq(jobsCache.url, url)))
    .limit(1)

  return record?.applicationId ?? null
}

export interface RecentApplicationItem {
  applicationId: string
  title: string
  company: string
  status: ApplicationStatus
  createdAt: string
  location: string | null
  applicationUrl: string
  postingUrl: string | null
}

export async function findExistingApplicationByUrl(
  userId: string,
  url: string,
  origin: string
): Promise<RecentApplicationItem | null> {
  const [row] = await db
    .select({
      applicationId: applications.id,
      status: applications.status,
      createdAt: applications.createdAt,
      title: jobsCache.title,
      company: jobsCache.company,
      location: jobsCache.location,
      postingUrl: jobsCache.url,
    })
    .from(applications)
    .innerJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(and(eq(applications.userId, userId), eq(jobsCache.url, url)))
    .orderBy(desc(applications.createdAt))
    .limit(1)

  if (!row) return null

  return {
    applicationId: row.applicationId,
    title: row.title ?? "Untitled role",
    company: row.company ?? "Unknown company",
    status: row.status ?? "saved",
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    location: row.location ?? null,
    applicationUrl: new URL(`/applications/${row.applicationId}`, origin).toString(),
    postingUrl: row.postingUrl ?? null,
  }
}

export async function listRecentApplicationsForUser(
  userId: string,
  origin: string,
  limit = 5
): Promise<RecentApplicationItem[]> {
  const rows = await db
    .select({
      applicationId: applications.id,
      status: applications.status,
      createdAt: applications.createdAt,
      title: jobsCache.title,
      company: jobsCache.company,
      location: jobsCache.location,
      postingUrl: jobsCache.url,
    })
    .from(applications)
    .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    applicationId: row.applicationId,
    title: row.title ?? "Untitled role",
    company: row.company ?? "Unknown company",
    status: row.status ?? "saved",
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
    location: row.location ?? null,
    applicationUrl: new URL(`/applications/${row.applicationId}`, origin).toString(),
    postingUrl: row.postingUrl ?? null,
  }))
}

const VALID_STATUSES = new Set<ApplicationStatus>([
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
  "ghosted",
])

export async function updateApplicationStatusForUser(
  userId: string,
  applicationId: string,
  status: ApplicationStatus
): Promise<boolean> {
  if (!VALID_STATUSES.has(status)) return false

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: applications.id,
        status: applications.status,
        appliedAt: applications.appliedAt,
      })
      .from(applications)
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
      .limit(1)

    if (!current) return false
    if (current.status === status) return true

    await tx
      .update(applications)
      .set({
        status,
        lastStatusUpdate: new Date(),
        ...(status === "applied" && !current.appliedAt ? { appliedAt: new Date() } : {}),
      })
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))

    await tx.insert(applicationStatusEvents).values({
      userId,
      applicationId,
      fromStatus: current.status,
      toStatus: status,
    })

    return true
  })
}

export async function persistJobForUser(
  userId: string,
  job: PersistedJobInput
): Promise<{ applicationId: string; alreadySaved: boolean }> {
  return db.transaction(async (tx) => {
    const [cachedJob] = await tx
      .insert(jobsCache)
      .values({
        url: job.url,
        source: job.source,
        title: job.title,
        company: job.company,
        location: job.location ?? null,
        description: job.description ?? null,
        salaryMin: toNumeric(job.salaryMin),
        salaryMax: toNumeric(job.salaryMax),
        salaryCurrency: job.salaryCurrency ?? "GBP",
        postedAt: toTimestamp(job.postedAt),
        isEasyApply: job.isEasyApply ?? false,
        applyDeadline: job.applyDeadline ?? null,
        isRemote: job.isRemote ?? null,
        remoteType: job.remoteType ?? null,
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: jobsCache.url,
        set: {
          source: job.source,
          title: job.title,
          company: job.company,
          location: job.location ?? null,
          description: job.description ?? null,
          salaryMin: toNumeric(job.salaryMin),
          salaryMax: toNumeric(job.salaryMax),
          salaryCurrency: job.salaryCurrency ?? "GBP",
          postedAt: toTimestamp(job.postedAt),
          isEasyApply: job.isEasyApply ?? false,
          applyDeadline: job.applyDeadline ?? null,
          isRemote: job.isRemote ?? null,
          remoteType: job.remoteType ?? null,
          scrapedAt: new Date(),
          lastSeenAt: new Date(),
        },
      })
      .returning({ id: jobsCache.id })

    const [insertedApplication] = await tx
      .insert(applications)
      .values({
        userId,
        jobId: cachedJob.id,
        status: "saved",
      })
      .onConflictDoNothing({
        target: [applications.userId, applications.jobId],
      })
      .returning({ id: applications.id })

    if (insertedApplication) {
      return {
        applicationId: insertedApplication.id,
        alreadySaved: false,
      }
    }

    const [existingApplication] = await tx
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.userId, userId), eq(applications.jobId, cachedJob.id)))
      .limit(1)

    if (!existingApplication) {
      throw new Error("Failed to create or find application")
    }

    return {
      applicationId: existingApplication.id,
      alreadySaved: true,
    }
  })
}
