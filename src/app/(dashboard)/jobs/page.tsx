import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { redirect } from "next/navigation"
import { JobsFeed } from "./jobs-feed"
import type { UserPreferences } from "@/lib/ai"

export const metadata: Metadata = {
  title: "Browse Roles",
}

export default async function JobsPage() {
  if (!isSupabaseConfigured()) {
    redirect("/auth")
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  const [{ data: profile }, { data: applications }] = await Promise.all([
    supabase
      .from("profiles")
      .select("desired_roles, locations_uk, target_salary_min, experience_level, preferences")
      .eq("id", user.id)
      .single(),
    supabase
      .from("applications")
      .select("jobs_cache(url)")
      .eq("user_id", user.id)
      .not("status", "in", '("rejected","withdrawn","ghosted")'),
  ])

  const prefs = (profile?.preferences ?? {}) as UserPreferences
  const jobSources = prefs.job_sources

  // Derive which sources the user has enabled
  const enabledSources: string[] = []
  // Adzuna is enabled by default unless explicitly disabled
  if (jobSources?.adzuna?.enabled !== false) {
    enabledSources.push("adzuna")
  }
  // Reed only if enabled and API key is set
  if (jobSources?.reed?.enabled && jobSources.reed.api_key) {
    enabledSources.push("reed")
  }
  // Careerjet only if enabled and server key is configured
  if (jobSources?.careerjet?.enabled && process.env.CAREERJET_API_KEY) {
    enabledSources.push("careerjet")
  }
  // Default to Adzuna if no sources configured
  if (enabledSources.length === 0) {
    enabledSources.push("adzuna")
  }
  // Tracked companies always available — queries jobs_cache for ATS-synced roles
  enabledSources.push("tracked")

  const savedJobUrls = (applications ?? [])
    .map((a) => ((a as unknown as { jobs_cache: { url: string } | null }).jobs_cache)?.url)
    .filter((url): url is string => !!url)

  // Pre-fill from preferences — use only the first role to keep the query focused
  const initialQuery = profile?.desired_roles?.[0] ?? ""
  const initialLocation = profile?.locations_uk?.[0] ?? ""
  const initialSalary = profile?.target_salary_min ? String(profile.target_salary_min) : ""
  const initialExperienceLevels = profile?.experience_level ?? []

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="space-y-3">
          <p className="page-kicker">Roles</p>
          <div className="space-y-2">
            <h1 className="page-title">Search with more restraint, save with more intent.</h1>
            <p className="page-lede max-w-2xl">
              Filters are pre-filled from your preferences. Adjust and search — save anything worth
              tailoring.
            </p>
          </div>
        </div>
      </div>

      <JobsFeed
        initialQuery={initialQuery}
        initialLocation={initialLocation}
        initialSalary={initialSalary}
        initialExperienceLevels={initialExperienceLevels}
        enabledSources={enabledSources}
        initialSavedUrls={savedJobUrls}
      />
    </div>
  )
}
