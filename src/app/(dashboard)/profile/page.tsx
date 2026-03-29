import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { redirect } from "next/navigation"
import type { CoverLetterTemplate } from "@/lib/supabase/database.types"
import { ProfileTabs } from "./profile-tabs"

export default async function ProfilePage() {
  if (!isSupabaseConfigured()) {
    redirect("/auth")
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  const [{ data: cvs }, { data: coverLetters }, { data: profile }] = await Promise.all([
    supabase
      .from("user_cvs")
      .select("id, name, is_primary, created_at, parsed_json")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("cover_letters")
      .select("id, label, content, tone")
      .eq("user_id", user.id)
      .is("application_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("desired_roles, locations_uk, target_salary_min, right_to_work_uk, experience_level")
      .eq("id", user.id)
      .single(),
  ])

  return (
    <div className="page-shell max-w-5xl">
      <div className="page-header">
        <div className="space-y-3">
          <p className="page-kicker">Profile</p>
          <div className="space-y-2">
            <h1 className="page-title">Your profile.</h1>
            <p className="page-lede">
              Manage your CVs, cover letters, and job search preferences.
            </p>
          </div>
        </div>
      </div>

      <ProfileTabs
        cvs={cvs ?? []}
        coverLetters={(coverLetters ?? []) as CoverLetterTemplate[]}
        profile={profile ?? null}
      />
    </div>
  )
}
