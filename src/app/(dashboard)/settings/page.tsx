import type { Metadata } from "next"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { redirect } from "next/navigation"
import { resolveAiSettings, type UserPreferences, type JobSources } from "@/lib/ai"
import { SettingsTabs } from "./settings-tabs"

export const metadata: Metadata = {
  title: "Settings",
}

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) redirect("/auth")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single()

  const preferences = profile?.preferences as UserPreferences | null
  const aiSettings = resolveAiSettings(preferences)

  const anthropicKeySource = preferences?.anthropic_api_key
    ? "saved"
    : process.env.ANTHROPIC_API_KEY ? "env" : "none"
  const openaiKeySource = preferences?.openai_api_key
    ? "saved"
    : process.env.OPENAI_API_KEY ? "env" : "none"

  const jobSources: JobSources = (preferences?.job_sources as JobSources) ?? {}

  const prefs = (profile?.preferences ?? {}) as Record<string, unknown>
  const preferredCvTemplate = (prefs.preferred_cv_template as string) ?? "modern"
  const preferredCoverLetterTemplate = (prefs.preferred_cover_letter_template as string) ?? "classic"

  return (
    <div className="page-shell max-w-4xl gap-6 py-5 md:gap-8 md:py-8 lg:min-h-0 lg:flex-1">
      <div className="page-header gap-3 pb-5 md:pb-6">
        <div className="space-y-3">
          <p className="page-kicker">Settings</p>
          <div className="space-y-2">
            <h1 className="page-title">Configure your assistant.</h1>
            <p className="page-lede max-w-2xl">
              Set up your AI provider, document templates, and job sources.
            </p>
          </div>
        </div>
      </div>

      <Suspense>
        <SettingsTabs
          aiSettings={aiSettings}
          keyStatus={{ anthropic: anthropicKeySource as "saved" | "env" | "none", openai: openaiKeySource as "saved" | "env" | "none" }}
          preferredCvTemplate={preferredCvTemplate}
          preferredCoverLetterTemplate={preferredCoverLetterTemplate}
          jobSources={jobSources}
        />
      </Suspense>
    </div>
  )
}
