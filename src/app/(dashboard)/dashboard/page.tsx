import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Briefcase, FileText, Search, Send } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button-styles"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Database } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"
import { APPLICATION_STATUS_OPTIONS } from "../applications/pipeline-metrics"

export const metadata: Metadata = {
  title: "Dashboard",
}

type RecentApplication = Pick<
  Database["public"]["Tables"]["applications"]["Row"],
  "id" | "slug" | "status" | "created_at" | "applied_at"
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
    { data: applicationStatuses },
    { data: recentAppsData },
  ] = await Promise.all([
    supabase
      .from("applications")
      .select("status")
      .eq("user_id", user.id),
    supabase
      .from("applications")
      .select(`
        id,
        slug,
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
  const totalApplications = (applicationStatuses ?? []).length
  const statusCounts = (applicationStatuses ?? []).reduce(
    (counts, application) => {
      counts[application.status] = (counts[application.status] ?? 0) + 1
      return counts
    },
    {} as Record<string, number>
  )

  const statusConfig: Record<string, { label: string; color: string }> = {
    saved: { label: "Saved", color: "border-border bg-secondary text-foreground" },
    applied: { label: "Applied", color: "border-border bg-secondary text-foreground" },
    screening: { label: "Screening", color: "border-border bg-secondary text-foreground" },
    interview: { label: "Interview", color: "border-border bg-secondary text-foreground" },
    offer: { label: "Offer", color: "border-border bg-secondary text-foreground" },
    rejected: { label: "Rejected", color: "border-destructive/20 bg-destructive/10 text-destructive" },
    withdrawn: { label: "Withdrawn", color: "border-border bg-secondary text-muted-foreground" },
    ghosted: { label: "Ghosted", color: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300" },
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
        <div className="section-label">Pipeline overview</div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          <Link
            href="/analytics"
            className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
          >
            <Card className="h-full bg-card py-4 transition-[border-color,box-shadow] group-hover:border-foreground/20 group-hover:shadow-[0_18px_34px_-30px_rgba(10,10,10,0.4)]">
              <CardContent className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <span className="metric-label">00</span>
                  <Badge className="h-8 gap-2 border-border bg-secondary/70 px-3 text-[10px] tracking-[0.12em] text-foreground">
                    Total
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="font-heading text-[2.2rem] leading-none tracking-[-0.05em] text-foreground">
                    {totalApplications}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium tracking-[0.02em]">Total applications</p>
                    <p className="text-[13px] text-muted-foreground">
                      Every tracked role across the full pipeline.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          {APPLICATION_STATUS_OPTIONS.map((option, index) => (
            <Link
              key={option.value}
              href={`/analytics?status=${option.value}`}
              className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
            >
              <Card className="h-full bg-card py-4 transition-[border-color,box-shadow] group-hover:border-foreground/20 group-hover:shadow-[0_18px_34px_-30px_rgba(10,10,10,0.4)]">
                <CardContent className="space-y-4 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="metric-label">{String(index + 1).padStart(2, "0")}</span>
                    <Badge className={cn("h-8 gap-2 px-3 text-[10px] tracking-[0.12em]", option.color)}>
                      <span className={cn("size-1.5 rounded-full", option.dot)} />
                      {option.label}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="font-heading text-[2.2rem] leading-none tracking-[-0.05em] text-foreground">
                      {statusCounts[option.value] ?? 0}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium tracking-[0.02em]">{option.label}</p>
                      <p className="text-[13px] text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.55fr_0.95fr]">
        <Card className="border-border">
          <CardHeader className="border-b border-foreground/10 bg-secondary/40 pb-6 shadow-[inset_0_0_0_1px_hsl(var(--border))]">
            <div className="space-y-3">
              <div className="space-y-3">
                <p className="section-label">Latest movement</p>
                <div className="space-y-2">
                  <CardTitle className="text-[1.7rem] tracking-[-0.045em]">
                    Recent applications
                  </CardTitle>
                  <CardDescription className="max-w-lg text-[14px]">
                    Your latest submissions and status changes.
                  </CardDescription>
                </div>
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
                      href={`/applications/${app.slug}`}
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

            <Link
              href="/applications"
              className={cn(buttonVariants({ size: "default" }), "mt-8 w-full justify-center")}
            >
              View all applications
            </Link>

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
