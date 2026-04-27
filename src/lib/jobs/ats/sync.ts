import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { jobsCache, trackedCompanies } from "@/lib/db/schema"
import { checkAtsRateLimit } from "@/lib/jobs/ats-rate-limit"
import type { PersistedJobInput } from "@/lib/jobs/persist-job"
import { classifyJobIndustry } from "@/lib/jobs/industry-classification"
import { sendNewJobAlerts } from "@/lib/beacon/job-alerts"
import { fetchGreenhouseJobs } from "./greenhouse"
import { fetchLeverJobs } from "./lever"
import { fetchAshbyJobs } from "./ashby"
import { fetchWorkdayJobs } from "./workday"

export interface SyncResult {
  companyId: string
  companyName: string
  synced: number
  newJobs: number
  errors: string[]
}

export async function upsertJobIntoCache(job: PersistedJobInput): Promise<void> {
  const industry = classifyJobIndustry(job.title)
  await db
    .insert(jobsCache)
    .values({
      url: job.url,
      source: job.source,
      title: job.title,
      company: job.company,
      location: job.location ?? null,
      description: job.description ?? null,
      salaryMin: job.salaryMin != null ? String(job.salaryMin) : null,
      salaryMax: job.salaryMax != null ? String(job.salaryMax) : null,
      salaryCurrency: job.salaryCurrency ?? "GBP",
      postedAt: job.postedAt ? new Date(job.postedAt) : null,
      isEasyApply: job.isEasyApply ?? false,
      applyDeadline: job.applyDeadline ?? null,
      isRemote: job.isRemote ?? null,
      remoteType: job.remoteType ?? null,
      industryKey: industry?.industryKey ?? null,
      industryLabel: industry?.industryLabel ?? null,
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: jobsCache.url,
      set: {
        title: job.title,
        company: job.company,
        location: job.location ?? null,
        description: job.description ?? null,
        isRemote: job.isRemote ?? null,
        remoteType: job.remoteType ?? null,
        industryKey: industry?.industryKey ?? null,
        industryLabel: industry?.industryLabel ?? null,
        scrapedAt: new Date(),
        lastSeenAt: new Date(),
      },
    })
}

export async function fetchJobsForCompany(company: {
  atsType: string | null
  atsBoardIdentifier: string | null
  name: string
}): Promise<PersistedJobInput[]> {
  const { atsType, atsBoardIdentifier, name } = company
  if (!atsBoardIdentifier) throw new Error("No board identifier set for this company")

  switch (atsType) {
    case "greenhouse":
      return fetchGreenhouseJobs(atsBoardIdentifier, name)
    case "lever":
      return fetchLeverJobs(atsBoardIdentifier, name)
    case "ashby":
      return fetchAshbyJobs(atsBoardIdentifier, name)
    case "workday":
      // atsBoardIdentifier stores the full careers URL for Workday
      return fetchWorkdayJobs(atsBoardIdentifier, name)
    default:
      throw new Error(`Unsupported ATS type: ${atsType}`)
  }
}

export async function syncTrackedCompany(
  companyId: string,
  userId: string,
  userEmail: string
): Promise<SyncResult> {
  const [company] = await db
    .select()
    .from(trackedCompanies)
    .where(and(eq(trackedCompanies.id, companyId), eq(trackedCompanies.userId, userId)))
    .limit(1)

  if (!company) throw new Error(`Tracked company not found: ${companyId}`)
  if (!company.enabled) {
    return { companyId, companyName: company.name, synced: 0, newJobs: 0, errors: ["Company sync is disabled"] }
  }

  const atsType = company.atsType ?? "unknown"
  const { allowed } = await checkAtsRateLimit(atsType)
  if (!allowed) {
    return { companyId, companyName: company.name, synced: 0, newJobs: 0, errors: ["Rate limit reached for this ATS"] }
  }

  const errors: string[] = []
  let synced = 0
  const newJobsList: PersistedJobInput[] = []

  try {
    const jobs = await fetchJobsForCompany(company)

    // Detect new jobs by diffing against existing URLs in a single query
    const urls = jobs.map((j) => j.url)
    const existingRows =
      urls.length > 0
        ? await db.select({ url: jobsCache.url }).from(jobsCache).where(inArray(jobsCache.url, urls))
        : []
    const existingUrls = new Set(existingRows.map((r) => r.url))

    for (const job of jobs) {
      try {
        await upsertJobIntoCache(job)
        synced++
        if (!existingUrls.has(job.url)) newJobsList.push(job)
      } catch (err) {
        errors.push(`Failed to upsert job "${job.title}": ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err))
  }

  await db
    .update(trackedCompanies)
    .set({ lastSyncedAt: new Date() })
    .where(eq(trackedCompanies.id, companyId))

  // Fire job alerts outside the main loop — don't block sync on email failure
  if (newJobsList.length > 0) {
    sendNewJobAlerts(userEmail, userId, newJobsList).catch((err) =>
      console.error(`[job-alerts] failed to send alerts for user ${userId}:`, err)
    )
  }

  return { companyId, companyName: company.name, synced, newJobs: newJobsList.length, errors }
}

export async function syncAllTrackedCompanies(userId: string, userEmail: string): Promise<SyncResult[]> {
  const companies = await db
    .select()
    .from(trackedCompanies)
    .where(and(eq(trackedCompanies.userId, userId), eq(trackedCompanies.enabled, true)))

  const results = await Promise.allSettled(companies.map((c) => syncTrackedCompany(c.id, userId, userEmail)))

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value
    return {
      companyId: companies[i].id,
      companyName: companies[i].name,
      synced: 0,
      newJobs: 0,
      errors: [r.reason instanceof Error ? r.reason.message : String(r.reason)],
    }
  })
}
