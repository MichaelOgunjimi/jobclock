"use server"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { persistJobForUser } from "@/lib/jobs/persist-job"
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
    })

    if (result.alreadySaved) return { alreadySaved: true }
    return { success: true }
  } catch {
    return { error: "Failed to save job" }
  }
}
