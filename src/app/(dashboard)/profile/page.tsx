import type { Metadata } from "next"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { redirect } from "next/navigation"
import { parseReviewFindings } from "@/lib/ai/cv-review-schemas"
import type { UserPreferences } from "@/lib/ai"
import { ProfileTabs } from "./profile-tabs"

export const metadata: Metadata = {
  title: "Profile",
}

export default async function ProfilePage() {
  if (!isSupabaseConfigured()) {
    redirect("/auth")
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  const [{ data: cvs }, { data: structures }, { data: profile }] = await Promise.all([
    supabase
      .from("user_cvs")
      .select("id, name, is_primary, created_at, parsed_json, review_findings")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("cover_letter_structures")
      .select("*")
      .or(`is_built_in.eq.true,user_id.eq.${user.id}`)
      .order("is_built_in", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .single(),
  ])

  const builtInStyles = (structures ?? []).filter((s) => s.is_built_in)
  const userStyles = (structures ?? []).filter((s) => !s.is_built_in)
  const preferences = (profile?.preferences ?? {}) as UserPreferences

  return (
    <div className="page-shell max-w-5xl">
      <div className="page-header">
        <div className="space-y-3">
          <p className="page-kicker">Profile</p>
          <div className="space-y-2">
            <h1 className="page-title">Your profile.</h1>
            <p className="page-lede">
              Manage your CVs and writing styles.
            </p>
          </div>
        </div>
      </div>

      <Suspense>
        <ProfileTabs
          cvs={(cvs ?? []).map(({ review_findings, ...cv }) => ({
            ...cv,
            review_finding_count: parseReviewFindings(review_findings).length,
          }))}
          builtInStyles={builtInStyles}
          userStyles={userStyles}
          generationAutomation={{
            generateCv: preferences.auto_generate_cv_on_job_add ?? false,
            generateCoverLetter: preferences.auto_generate_cover_letter_on_job_add ?? false,
          }}
        />
      </Suspense>
    </div>
  )
}
