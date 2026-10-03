import { and, asc, eq, inArray, isNotNull, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications, jobsCache } from "@/lib/db/schema"
import { appOrigin } from "./recent-jobs"
import { formatStats, getApplicationStats } from "./stats"

/** Open applications where an employer reply is still pending, so a follow-up makes sense. */
const FOLLOW_UP_STATUSES = ["applied", "screening", "interview"] as const
const MAX_FOLLOW_UPS = 5

export interface FollowUpItem {
  title: string
  company: string
  dueAt: string
  url: string
}

/** Renders the weekly digest: overdue follow-ups first, then the week's stats. */
export function formatDigest(followUps: FollowUpItem[], statsText: string): string {
  const parts = ["Your weekly JobClock digest"]
  if (followUps.length > 0) {
    parts.push(
      `Follow-ups due:\n${followUps
        .map((item) => `• ${item.title} at ${item.company} (due ${item.dueAt.slice(0, 10)})\n  ${item.url}`)
        .join("\n")}`
    )
  }
  parts.push(statsText, "Turn this off any time with /digest off.")
  return parts.join("\n\n")
}

async function listOverdueFollowUps(userId: string): Promise<FollowUpItem[]> {
  const rows = await db
    .select({
      slug: applications.slug,
      dueAt: applications.followUpDueAt,
      title: jobsCache.title,
      company: jobsCache.company,
      customTitle: applications.customTitle,
      customCompany: applications.customCompany,
    })
    .from(applications)
    .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(
      and(
        eq(applications.userId, userId),
        isNotNull(applications.followUpDueAt),
        lte(applications.followUpDueAt, new Date()),
        inArray(applications.status, [...FOLLOW_UP_STATUSES])
      )
    )
    .orderBy(asc(applications.followUpDueAt))
    .limit(MAX_FOLLOW_UPS)

  return rows.map((row) => ({
    title: row.customTitle ?? row.title ?? "Untitled role",
    company: row.customCompany ?? row.company ?? "Unknown company",
    dueAt: row.dueAt!.toISOString(),
    url: new URL(`/applications/${row.slug}`, appOrigin()).toString(),
  }))
}

/** Builds the digest text for one user, or null when there is nothing to report. */
export async function buildDigest(userId: string): Promise<string | null> {
  const [followUps, stats] = await Promise.all([listOverdueFollowUps(userId), getApplicationStats(userId)])
  if (Object.keys(stats.byStatus).length === 0) return null
  return formatDigest(followUps, formatStats(stats))
}
