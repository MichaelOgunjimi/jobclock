"use server"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { persistJobForUser } from "@/lib/jobs/persist-job"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { ignoredJobs, jobsCache } from "@/lib/db/schema"
import type { Job } from "@/lib/jobs/types"

export async function saveJob(job: Job) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  try {
    const result = await persistJobForUser(user.id, {
      url: job.url,
      source: job.source,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      postedAt: job.postedAt,
      isEasyApply: job.isEasyApply,
      applyDeadline: job.applyDeadline,
      isRemote: job.isRemote,
      remoteType: job.remoteType,
    })

    if (result.alreadySaved) return { alreadySaved: true }
    return { success: true }
  } catch {
    return { error: "Failed to save job" }
  }
}

export async function ignoreJob(jobUrl: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const [cached] = await db.select({ id: jobsCache.id }).from(jobsCache).where(eq(jobsCache.url, jobUrl)).limit(1)
  if (!cached) return {}

  await db
    .insert(ignoredJobs)
    .values({ userId: user.id, jobId: cached.id })
    .onConflictDoNothing()

  return {}
}

export async function unignoreJob(jobUrl: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const [cached] = await db.select({ id: jobsCache.id }).from(jobsCache).where(eq(jobsCache.url, jobUrl)).limit(1)
  if (!cached) return {}

  await db
    .delete(ignoredJobs)
    .where(and(eq(ignoredJobs.userId, user.id), eq(ignoredJobs.jobId, cached.id)))

  return {}
}
