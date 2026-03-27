import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Briefcase, Send, Clock, TrendingUp, Search, FileText } from "lucide-react"
import type { Database } from "@/lib/supabase/database.types"

type RecentApplication = Pick<
  Database["public"]["Tables"]["applications"]["Row"],
  "id" | "status" | "created_at" | "applied_at"
> & {
  jobs_cache: Pick<
    Database["public"]["Tables"]["jobs_cache"]["Row"],
    "title" | "company" | "location"
  > | null
}

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return null
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Fetch stats
  const { count: totalApplications } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)

  const { count: pendingApplications } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "applied")

  const { count: interviewCount } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "interview")

  const { count: savedCount } = await supabase
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "saved")

  // Recent applications
  const { data: recentAppsData } = await supabase
    .from("applications")
    .select(`
      id,
      status,
      created_at,
      applied_at,
      jobs_cache (
        title,
        company,
        location
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5)

  const recentApps = (recentAppsData ?? []) as RecentApplication[]

  const statCards = [
    {
      index: "01",
      title: "Total applications",
      value: totalApplications ?? 0,
      icon: Send,
      note: "Tracked roles in your pipeline",
      cardClassName: "border-[#cdd8f6] bg-[#f5f8ff]",
      iconClassName: "border-[#cdd8f6] bg-white text-[#3558a3]",
      valueClassName: "text-[#23345f]",
      eyebrowClassName: "text-[#5f74a5]",
    },
    {
      index: "02",
      title: "Saved roles",
      value: savedCount ?? 0,
      icon: Briefcase,
      note: "Posts worth tailoring for next",
      cardClassName: "border-[#d6e8dc] bg-[#f3faf5]",
      iconClassName: "border-[#d6e8dc] bg-white text-[#3c7a57]",
      valueClassName: "text-[#264b37]",
      eyebrowClassName: "text-[#5f8a70]",
    },
    {
      index: "03",
      title: "Interview rounds",
      value: interviewCount ?? 0,
      icon: Clock,
      note: "Conversations currently progressing",
      cardClassName: "border-[#f0dcc4] bg-[#fff8ef]",
      iconClassName: "border-[#f0dcc4] bg-white text-[#a86b27]",
      valueClassName: "text-[#6f4516]",
      eyebrowClassName: "text-[#b38756]",
    },
    {
      index: "04",
      title: "Awaiting reply",
      value: pendingApplications ?? 0,
      icon: TrendingUp,
      note: "Applications with no decision yet",
      cardClassName: "border-[#ddd6f4] bg-[#f8f6ff]",
      iconClassName: "border-[#ddd6f4] bg-white text-[#6a58a8]",
      valueClassName: "text-[#43366f]",
      eyebrowClassName: "text-[#8a7cb2]",
    },
  ]

  const statusConfig: Record<string, { label: string; color: string }> = {
    saved: { label: "Saved", color: "border-[#d6e8dc] bg-[#f3faf5] text-[#3c7a57]" },
    applied: { label: "Applied", color: "border-[#cdd8f6] bg-[#f5f8ff] text-[#3558a3]" },
    screening: { label: "Screening", color: "border-[#ddd6f4] bg-[#f8f6ff] text-[#6a58a8]" },
    interview: { label: "Interview", color: "border-[#f0dcc4] bg-[#fff8ef] text-[#a86b27]" },
    offer: { label: "Offer", color: "border-[#f1d7c9] bg-[#fff3ed] text-[#a45a3a]" },
    rejected: { label: "Rejected", color: "border-destructive/20 bg-destructive/10 text-destructive" },
    withdrawn: { label: "Withdrawn", color: "border-border bg-secondary text-muted-foreground" },
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="space-y-3">
          <p className="page-kicker">Overview</p>
          <div className="space-y-2">
            <h1 className="page-title">Your search, arranged like an editor&rsquo;s desk.</h1>
            <p className="page-lede max-w-2xl">
              Follow your applications, surface the strongest open roles, and keep the next
              move obvious.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/jobs">
              <Search className="h-4 w-4" />
              Browse roles
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/profile">
              <FileText className="h-4 w-4" />
              Refine CV
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="section-label">Current volume</div>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon
            return (
              <Card key={card.title} className={card.cardClassName}>
                <CardContent className="space-y-6 pt-1">
                <div className="flex items-center justify-between">
                    <span className={`metric-label ${card.eyebrowClassName}`}>{card.index}</span>
                    <div className={`flex size-11 items-center justify-center border ${card.iconClassName}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                </div>
                <div className="space-y-3">
                    <div className={`metric-value ${card.valueClassName}`}>{card.value}</div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium tracking-[0.02em]">{card.title}</p>
                    <p className="text-[13px] text-muted-foreground">{card.note}</p>
                  </div>
                </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.5fr_1fr]">
        <Card className="bg-secondary">
          <CardHeader className="border-b pb-6">
            <p className="section-label">Latest movement</p>
            <CardTitle>Recent applications</CardTitle>
            <CardDescription>Your latest submissions and status changes.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentApps.length === 0 ? (
              <div className="flex flex-col items-start gap-3 py-10 text-muted-foreground">
                <Briefcase className="h-8 w-8" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">No applications yet</p>
                  <p className="text-sm">Start by browsing roles and saving promising opportunities.</p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {recentApps.map((app) => {
                  const config = statusConfig[app.status] ?? {
                    label: app.status,
                    color: "border-border bg-secondary text-muted-foreground",
                  }
                  return (
                    <div key={app.id} className="flex items-start justify-between gap-4 py-5 first:pt-0 last:pb-0">
                      <div className="space-y-2">
                        <p className="font-heading text-[1.2rem] leading-none tracking-[-0.03em]">
                          {app.jobs_cache?.title ?? "Unknown Job"}
                        </p>
                        <div className="space-y-1">
                          <p className="text-[13px] font-medium tracking-[0.02em]">
                            {app.jobs_cache?.company ?? "Unknown Company"}
                          </p>
                          <p className="text-[12px] text-muted-foreground">
                            Updated {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge className={config.color}>{config.label}</Badge>
                    </div>
                  )
                })}
              </div>
            )}
            <Button asChild className="mt-8 w-full">
              <Link href="/applications">View All Applications</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#d7dff2] bg-[#eef3fb]">
          <CardHeader className="border-b border-[#d7dff2] pb-6">
            <p className="section-label text-[#62759d]">Next steps</p>
            <CardTitle className="text-[#24344f]">Quick actions</CardTitle>
            <CardDescription className="text-[#5f6f8f]">
              Keep the pipeline moving with the next obvious task.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full justify-start border-[#24344f] bg-[#24344f] text-white hover:border-[#35507b] hover:bg-[#35507b]">
              <Link href="/jobs">
                <Search className="h-4 w-4 mr-2" />
                Browse Jobs
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start border-[#bcc8e2] bg-white/70 text-[#24344f] hover:border-[#99abcf] hover:bg-white">
              <Link href="/profile">
                <FileText className="h-4 w-4 mr-2" />
                Update My CV
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start border-[#bcc8e2] bg-white/70 text-[#24344f] hover:border-[#99abcf] hover:bg-white">
              <Link href="/applications">
                <Send className="h-4 w-4 mr-2" />
                Track Applications
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
