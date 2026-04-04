import type { Metadata } from "next"
import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { redirect } from "next/navigation"
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

  const [{ data: cvs }, { data: structures }] = await Promise.all([
    supabase
      .from("user_cvs")
      .select("id, name, is_primary, created_at, parsed_json")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("cover_letter_structures")
      .select("*")
      .or(`is_built_in.eq.true,user_id.eq.${user.id}`)
      .order("is_built_in", { ascending: false })
      .order("created_at", { ascending: true }),
  ])

  const builtInStyles = (structures ?? []).filter((s) => s.is_built_in)
  const userStyles = (structures ?? []).filter((s) => !s.is_built_in)

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
          cvs={cvs ?? []}
          builtInStyles={builtInStyles}
          userStyles={userStyles}
        />
      </Suspense>
    </div>
  )
}
