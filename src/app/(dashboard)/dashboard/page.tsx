import Link from "next/link"
import { redirect } from "next/navigation"
import { Briefcase, Clock, FileText, Search, Send, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button-styles"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Database } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"

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
  if (!isSupabaseConfigured()) redirect("/auth")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth")

  const [
    { count: totalApplications },
    { count: pendingApplications },
    { count: interviewCount },
    { count: savedCount },
    { data: recentAppsData },
  ] = await Promise.all([
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "applied"),
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "interview"),
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "saved"),
    supabase
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
      .limit(5),
  ])

  const recentApps = (recentAppsData ?? []) as RecentApplication[]

  const statCards = [
    {
      index: "01",
      title: "Total applications",
      value: totalApplications ?? 0,
      icon: Send,
      note: "Tracked roles in your pipeline",
    },
    {
      index: "02",
      title: "Saved roles",
      value: savedCount ?? 0,
      icon: Briefcase,
      note: "Posts worth tailoring for next",
    },
    {
      index: "03",
      title: "Interview rounds",
      value: interviewCount ?? 0,
      icon: Clock,
      note: "Conversations currently progressing",
    },
    {
      index: "04",
      title: "Awaiting reply",
      value: pendingApplications ?? 0,
      icon: TrendingUp,
      note: "Applications with no decision yet",
    },
  ]

  const statusConfig: Record<string, { label: string; color: string }> = {
    saved: { label: "Saved", color: "border-border bg-secondary text-foreground" },
    applied: { label: "Applied", color: "border-border bg-secondary text-foreground" },
    screening: { label: "Screening", color: "border-border bg-secondary text-foreground" },
    interview: { label: "Interview", color: "border-border bg-secondary text-foreground" },
    offer: { label: "Offer", color: "border-border bg-secondary text-foreground" },
    rejected: { label: "Rejected", color: "border-destructive/20 bg-destructive/10 text-destructive" },
    withdrawn: { label: "Withdrawn", color: "border-border bg-secondary text-muted-foreground" },
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="space-y-3">
          <p className="page-kicker">Overview</p>
          <div className="space-y-2">
            <h1 className="page-title">A calmer control room for your search.</h1>
            <p className="page-lede max-w-2xl">
              Review your application volume, check recent movement, and move straight into the next useful action.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/jobs" className={buttonVariants({ size: "default" })}>
            <Search className="h-4 w-4" />
            Browse roles
          </Link>
          <Link href="/profile" className={buttonVariants({ size: "default", variant: "outline" })}>
            <FileText className="h-4 w-4" />
            Refine CV
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        <div className="section-label">Current volume</div>
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon

            return (
              <Card key={card.title} className="border-border">
                <CardContent className="space-y-6 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="metric-label">{card.index}</span>
                    <div className="flex size-11 items-center justify-center border border-border bg-secondary text-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="metric-value">{card.value}</div>
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

      <div className="grid gap-8 xl:grid-cols-[1.55fr_0.95fr]">
        <Card className="border-border">
          <CardHeader className="border-b bg-secondary/20 pb-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-3">
                <p className="section-label">Latest movement</p>
                <div className="space-y-2">
                  <CardTitle className="text-[1.75rem] tracking-[-0.04em]">
                    Recent applications
                  </CardTitle>
                  <CardDescription className="max-w-xl">
                    Your latest submissions and status changes.
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-3 self-start sm:self-auto">
                <div className="border border-border bg-background px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Showing
                  </p>
                  <p className="mt-1 font-heading text-[1.35rem] leading-none tracking-[-0.05em]">
                    {recentApps.length}
                  </p>
                </div>
                <Link
                  href="/applications"
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }), "justify-center")}
                >
                  Open pipeline
                </Link>
              </div>
            </div>
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
                    <Link
                      key={app.id}
                      href={`/applications/${app.id}`}
                      className="group -mx-6 flex items-start justify-between gap-4 px-6 py-5 transition-colors hover:bg-secondary/60 first:pt-0 last:pb-0"
                    >
                      <div className="space-y-2">
                        <p className="font-heading text-[1.2rem] leading-none tracking-[-0.03em] transition-colors group-hover:text-foreground/80">
                          {app.jobs_cache?.title ?? "Unknown job"}
                        </p>
                        <div className="space-y-1">
                          <p className="text-[13px] font-medium tracking-[0.02em]">
                            {app.jobs_cache?.company ?? "Unknown company"}
                          </p>
                          <p className="text-[12px] text-muted-foreground">
                            Updated {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge className={config.color}>{config.label}</Badge>
                    </Link>
                  )
                })}
              </div>
            )}

          </CardContent>
        </Card>

        <Card className="border-border bg-secondary/60">
          <CardHeader className="border-b pb-6">
            <p className="section-label">Next steps</p>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>
              Keep the pipeline moving with the next obvious task.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/jobs" className={cn(buttonVariants({ size: "default" }), "w-full justify-start")}>
              <Search className="mr-2 h-4 w-4" />
              Browse jobs
            </Link>
            <Link
              href="/profile"
              className={cn(buttonVariants({ size: "default", variant: "outline" }), "w-full justify-start")}
            >
              <FileText className="mr-2 h-4 w-4" />
              Update my CV
            </Link>
            <Link
              href="/applications"
              className={cn(buttonVariants({ size: "default", variant: "outline" }), "w-full justify-start")}
            >
              <Send className="mr-2 h-4 w-4" />
              Track applications
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
