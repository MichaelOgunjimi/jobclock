"use server"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { Job } from "@/lib/jobs/types"

export async function saveJob(job: Job) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const { error: upsertError } = await supabase.from("jobs_cache").upsert(
    {
      id: job.id,
      url: job.url,
      source: job.source,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      salary_min: job.salaryMin,
      salary_max: job.salaryMax,
      salary_currency: job.salaryCurrency,
      posted_at: job.postedAt,
      is_easy_apply: job.isEasyApply ?? false,
    },
    { onConflict: "id" }
  )

  if (upsertError) return { error: "Failed to cache job" }

  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("job_id", job.id)
    .maybeSingle()

  if (existing) return { alreadySaved: true }

  const { error: insertError } = await supabase.from("applications").insert({
    user_id: user.id,
    job_id: job.id,
    status: "saved",
  })

  if (insertError) return { error: "Failed to save job" }

  return { success: true }
}
