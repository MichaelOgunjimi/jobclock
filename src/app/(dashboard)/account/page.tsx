import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Code2, ExternalLink, Globe, Link2, Mail, Phone } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AccountForm } from "./account-form"
import { toExternalProfileHref } from "./account-link-utils"

export const metadata: Metadata = { title: "Account" }

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
    { label: "Email", value: user.email ?? null, placeholder: "Not set", icon: Mail, href: user.email ? `mailto:${user.email}` : null },
    { label: "Phone", value: profile?.phone ?? null, placeholder: "Add a phone number", icon: Phone, href: profile?.phone ? `tel:${profile.phone}` : null },
    { label: "LinkedIn", value: profile?.linkedin_url ?? null, placeholder: "Add your LinkedIn URL", icon: Link2, href: toExternalProfileHref(profile?.linkedin_url), external: true },
    { label: "GitHub", value: profile?.github_url ?? null, placeholder: "Add your GitHub URL", icon: Code2, href: toExternalProfileHref(profile?.github_url), external: true },
    { label: "Portfolio", value: profile?.portfolio_url ?? null, placeholder: "Add your portfolio", icon: Globe, href: toExternalProfileHref(profile?.portfolio_url), external: true },
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
            {summaryItems.map(({ label, value, placeholder, icon: Icon, href, external }) => (
              <div key={label} className="flex items-start gap-3 border border-border bg-background px-4 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center border bg-secondary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="section-label">{label}</p>
                  {href ? (
                    <a
                      href={href}
                      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="flex items-center gap-1.5 break-all text-sm text-foreground underline-offset-2 hover:underline"
                    >
                      <span className="break-all">{value}</span>
                      {external && <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />}
                    </a>
                  ) : (
                    <p className="break-all text-sm text-muted-foreground">{value ?? placeholder}</p>
                  )}
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
