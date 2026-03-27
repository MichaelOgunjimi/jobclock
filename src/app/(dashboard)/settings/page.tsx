import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { redirect } from "next/navigation"
import { resolveAiSettings, type UserPreferences } from "@/lib/ai"
import { SettingsTabs } from "./settings-tabs"

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) redirect("/auth")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences, cv_template_path, cover_letter_template_path")
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

  return (
    <div className="page-shell max-w-4xl lg:min-h-0 lg:flex-1">
      <div className="page-header">
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

      <SettingsTabs
        aiSettings={aiSettings}
        keyStatus={{ anthropic: anthropicKeySource as "saved" | "env" | "none", openai: openaiKeySource as "saved" | "env" | "none" }}
        hasCvTemplate={!!profile?.cv_template_path}
        hasCoverLetterTemplate={!!profile?.cover_letter_template_path}
      />
    </div>
  )
}
