import { redirect } from "next/navigation"
import { Code2, Globe, Link2, Mail, Phone } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AccountForm } from "./account-form"

export default async function AccountPage() {
  if (!isSupabaseConfigured()) redirect("/auth")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth")

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, linkedin_url, github_url, portfolio_url, avatar_url")
    .eq("id", user.id)
    .single()

  const summaryItems = [
    { label: "Email", value: user.email ?? "Not set", icon: Mail },
    { label: "Phone", value: profile?.phone ?? "Add a phone number", icon: Phone },
    { label: "LinkedIn", value: profile?.linkedin_url ?? "Add your LinkedIn URL", icon: Link2 },
    { label: "GitHub", value: profile?.github_url ?? "Add your GitHub URL", icon: Code2 },
    { label: "Portfolio", value: profile?.portfolio_url ?? "Add your portfolio", icon: Globe },
  ]

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="space-y-3">
          <p className="page-kicker">Account</p>
          <div className="space-y-2">
            <h1 className="page-title">Personal details.</h1>
            <p className="page-lede">
              Your name, links, and contact information used in generated materials and application forms.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[0.9fr_1.35fr]">
        <Card className="border-border bg-secondary/60">
          <CardHeader className="border-b pb-6">
            <p className="section-label">Snapshot</p>
            <CardTitle>What the app knows about you.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summaryItems.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-start gap-3 border border-border bg-background px-4 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center border bg-secondary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="section-label">{label}</p>
                  <p className="break-all text-sm text-foreground">{value}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <AccountForm
          userId={user.id}
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
    </div>
  )
}
