import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { eq, and, sql, count } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications, jobsCache } from "@/lib/db/schema"
import { differenceInDays } from "date-fns"
import { cn } from "@/lib/utils"
import type { ApplicationStatus } from "@/lib/supabase/database.types"

export const metadata: Metadata = {
  title: "Analytics",
}

const STATUS_ORDER: ApplicationStatus[] = ["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn"]

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
}

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  saved: "bg-secondary border-border",
  applied: "bg-blue-500/15 border-blue-500/30",
  screening: "bg-violet-500/15 border-violet-500/30",
  interview: "bg-amber-500/15 border-amber-500/30",
  offer: "bg-emerald-500/15 border-emerald-500/30",
  rejected: "bg-red-500/15 border-red-500/30",
  withdrawn: "bg-secondary border-border",
}

function StatCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-4xl leading-none">{value}</p>
      {sublabel && <p className="mt-1.5 text-xs text-muted-foreground">{sublabel}</p>}
    </div>
  )
}

export default async function AnalyticsPage() {
  if (!isSupabaseConfigured()) redirect("/auth")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  const rows = await db
    .select({
      status: applications.status,
      createdAt: applications.createdAt,
      lastStatusUpdate: applications.lastStatusUpdate,
      appliedAt: applications.appliedAt,
      source: applications.source,
      jobSource: jobsCache.source,
    })
    .from(applications)
    .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(eq(applications.userId, user.id))

  const countsByStatus = STATUS_ORDER.reduce(
    (acc, s) => { acc[s] = 0; return acc },
    {} as Record<ApplicationStatus, number>
  )
  for (const row of rows) {
    if (row.status) countsByStatus[row.status] = (countsByStatus[row.status] ?? 0) + 1
  }

  const total = rows.length
  const active = rows.filter((r) => !["rejected", "withdrawn"].includes(r.status ?? "")).length
  const offers = countsByStatus.offer
  const interviews = countsByStatus.interview

  const appliedRows = rows.filter((r) => r.appliedAt)
  const avgDaysToApply =
    appliedRows.length === 0
      ? null
      : Math.round(
          appliedRows.reduce((sum, r) => sum + differenceInDays(new Date(r.appliedAt!), new Date(r.createdAt!)), 0) /
            appliedRows.length
        )

  const sourceCounts: Record<string, number> = {}
  for (const row of rows) {
    const src = row.jobSource ?? row.source ?? "manual"
    sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
  }
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const maxCount = Math.max(...STATUS_ORDER.map((s) => countsByStatus[s]))

  return (
    <div className="page-shell max-w-5xl gap-6 py-5 md:gap-8 md:py-8 lg:min-h-0 lg:flex-1">
      <div className="page-header gap-3 pb-5 md:pb-6">
        <div className="space-y-3">
          <p className="page-kicker">Analytics</p>
          <div className="space-y-2">
            <h1 className="page-title">Your pipeline.</h1>
            <p className="page-lede max-w-2xl">
              Track how your applications are progressing and spot patterns in your job search.
            </p>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total applications" value={total} />
        <StatCard label="Active" value={active} sublabel="Not rejected or withdrawn" />
        <StatCard label="Interviews" value={interviews} sublabel={total > 0 ? `${Math.round((interviews / total) * 100)}% rate` : undefined} />
        <StatCard label="Offers" value={offers} sublabel={interviews > 0 ? `${Math.round((offers / interviews) * 100)}% from interview` : undefined} />
      </div>

      {/* Funnel */}
      <div className="border border-border bg-card p-6">
        <p className="mb-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Application funnel</p>
        <div className="space-y-3">
          {STATUS_ORDER.filter((s) => !["rejected", "withdrawn"].includes(s)).map((status) => {
            const n = countsByStatus[status]
            const pct = maxCount > 0 ? Math.max(4, Math.round((n / maxCount) * 100)) : 4
            return (
              <div key={status} className="flex items-center gap-4">
                <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{STATUS_LABELS[status]}</span>
                <div className="relative flex-1">
                  <div className={cn("border h-8 transition-all", STATUS_COLORS[status])} style={{ width: `${pct}%`, minWidth: "2rem" }} />
                </div>
                <span className="w-8 shrink-0 text-sm font-medium">{n}</span>
              </div>
            )
          })}
        </div>
        {/* Rejected / Withdrawn separately */}
        <div className="mt-5 flex gap-8 border-t border-border pt-4">
          {(["rejected", "withdrawn"] as ApplicationStatus[]).map((s) => (
            <div key={s}>
              <p className="text-xs text-muted-foreground">{STATUS_LABELS[s]}</p>
              <p className="font-heading text-2xl">{countsByStatus[s]}</p>
            </div>
          ))}
          {avgDaysToApply !== null && (
            <div className="ml-auto">
              <p className="text-xs text-muted-foreground">Avg. days saved → applied</p>
              <p className="font-heading text-2xl">{avgDaysToApply}</p>
            </div>
          )}
        </div>
      </div>

      {/* Source breakdown */}
      {topSources.length > 0 && (
        <div className="border border-border bg-card p-6">
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Applications by source</p>
          <div className="space-y-2">
            {topSources.map(([src, n]) => (
              <div key={src} className="flex items-center justify-between text-sm">
                <span className="capitalize text-muted-foreground">{src}</span>
                <span className="font-medium">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
