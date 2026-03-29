import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { redirect } from "next/navigation"
import { AccountForm } from "./account-form"

export default async function AccountPage() {
  if (!isSupabaseConfigured()) redirect("/auth")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, linkedin_url, github_url, portfolio_url, avatar_url")
    .eq("id", user.id)
    .single()

  return (
    <div className="page-shell max-w-2xl">
      <div className="page-header">
        <div className="space-y-3">
          <p className="page-kicker">Account</p>
          <div className="space-y-2">
            <h1 className="page-title">Personal details.</h1>
            <p className="page-lede">
              Your name and contact info — used in cover letters and application forms.
            </p>
          </div>
        </div>
      </div>

      <AccountForm
        initialData={{
          fullName: profile?.full_name ?? "",
          phone: profile?.phone ?? "",
          linkedinUrl: profile?.linkedin_url ?? "",
          githubUrl: profile?.github_url ?? "",
          portfolioUrl: profile?.portfolio_url ?? "",
          avatarUrl: profile?.avatar_url ?? "",
          email: user.email ?? "",
        }}
      />
    </div>
  )
}
