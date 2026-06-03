import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications, applicationStatusEvents, jobsCache } from "@/lib/db/schema"
import { differenceInDays } from "date-fns"
import { cn } from "@/lib/utils"
import type { ApplicationStatus } from "@/lib/supabase/database.types"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { buildPipelineFlowMetrics, buildPipelineMetrics, getApplicationStatusOption } from "../applications/pipeline-metrics"
import { PipelineSankeyCanvas } from "./pipeline-sankey-canvas"
import { buildAnalyticsOverviewCards, buildAnalyticsStatusFocusLinks, getAnalyticsEmptyState } from "./analytics-overview"
import { Briefcase, GitBranch, Sigma } from "lucide-react"

export const metadata: Metadata = {
  title: "Analytics",
}

const STATUS_ORDER: ApplicationStatus[] = ["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn", "ghosted"]

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  ghosted: "Ghosted",
}

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  saved: "bg-secondary border-border",
  applied: "bg-blue-500/15 border-blue-500/30",
  screening: "bg-violet-500/15 border-violet-500/30",
  interview: "bg-amber-500/15 border-amber-500/30",
  offer: "bg-emerald-500/15 border-emerald-500/30",
  rejected: "bg-red-500/15 border-red-500/30",
  withdrawn: "bg-secondary border-border",
  ghosted: "bg-fuchsia-500/15 border-fuchsia-500/30",
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>
}) {
  if (!isSupabaseConfigured()) redirect("/auth")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  const [rows, transitionRows] = await Promise.all([
    db
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
      .where(eq(applications.userId, user.id)),
    db
      .select({
        fromStatus: applicationStatusEvents.fromStatus,
        toStatus: applicationStatusEvents.toStatus,
      })
      .from(applicationStatusEvents)
      .where(eq(applicationStatusEvents.userId, user.id))
      .orderBy(asc(applicationStatusEvents.createdAt)),
  ])

  const countsByStatus = STATUS_ORDER.reduce(
    (acc, s) => { acc[s] = 0; return acc },
    {} as Record<ApplicationStatus, number>
  )
  for (const row of rows) {
    if (row.status) countsByStatus[row.status] = (countsByStatus[row.status] ?? 0) + 1
  }

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
  const pipelineMetrics = buildPipelineMetrics(rows)
  const flow = buildPipelineFlowMetrics(transitionRows)
  const params = searchParams ? await searchParams : undefined
  const focusOption = getApplicationStatusOption(params?.status ?? null)
  const focusCount = focusOption ? pipelineMetrics.statusCounts[focusOption.value] : null
  const focusLinks = buildAnalyticsStatusFocusLinks(params?.status ?? null)
  const emptyState = getAnalyticsEmptyState({
    totalApplications: pipelineMetrics.total,
    transitionCount: flow.links.length,
  })
  const overviewCards = buildAnalyticsOverviewCards({
    total: pipelineMetrics.total,
    active: pipelineMetrics.active,
    sent: pipelineMetrics.sent,
    closed: pipelineMetrics.closed,
    interviews,
    offers,
  })

  return (
    <div className="page-shell gap-6 py-5 md:gap-8 md:py-8 lg:min-h-0 lg:flex-1">
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

      <section className="space-y-4">
        <div className="section-label">Overview</div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
          {focusOption && focusCount !== null && (
            <PipelineMetricCard
              label={`${focusOption.label} selected`}
              value={focusCount}
              note={`${formatShare(focusCount, pipelineMetrics.total)} of the total pipeline.`}
            />
          )}
          {overviewCards.map((card) => (
            <PipelineMetricCard key={card.label} label={card.label} value={card.value} note={card.note} />
          ))}
        </div>
      </section>

      {emptyState === "no-applications" ? (
        <Card className="bg-card py-0">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center border border-border bg-secondary/60">
              <Briefcase className="h-5 w-5 text-muted-foreground" />
            </span>
            <div className="space-y-2">
              <CardTitle className="text-lg">No applications to analyse yet</CardTitle>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                Save your first role from Jobs, then analytics will show stage counts, movement history, and source patterns here.
              </p>
            </div>
            <Link
              href="/jobs"
              className="inline-flex h-10 items-center justify-center border border-border bg-background px-4 text-[12px] font-semibold uppercase tracking-[0.10em] text-foreground transition-colors hover:border-foreground/30"
            >
              Find roles
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="space-y-4">
            <div className="section-label">Status flow</div>
            <Card className="overflow-hidden bg-card py-0">
              <CardContent className="p-0">
                <div className="border-b border-border px-6 py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center border border-border bg-secondary/60">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <div>
                        <CardTitle className="text-base">Application flow</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {focusOption
                            ? `${focusOption.label} is highlighted; the other paths are dimmed for context.`
                            : "Applications start at Saved, then move through active work and closed outcomes."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:max-w-xl lg:justify-end">
                      {focusLinks.map((link) => (
                        <Link
                          key={link.value}
                          href={link.href}
                          className={cn(
                            "inline-flex h-8 items-center gap-2 border px-3 text-[11px] font-semibold uppercase tracking-[0.10em] transition-colors",
                            link.active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                          )}
                          aria-current={link.active ? "page" : undefined}
                        >
                          {link.accent && (
                            <span
                              className="size-1.5 rounded-full"
                              style={{ backgroundColor: link.active ? "currentColor" : link.accent }}
                            />
                          )}
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
                {emptyState === "no-transitions" && (
                  <div className="border-b border-border bg-secondary/20 px-6 py-3 text-sm text-muted-foreground">
                    No movement history yet. Change an application status and the flow paths will start building from Saved.
                  </div>
                )}
                <PipelineSankeyCanvas
                  metrics={pipelineMetrics}
                  links={flow.links}
                  maxLinkCount={flow.maxLinkCount}
                  focusedStatus={focusOption?.value ?? null}
                />
              </CardContent>
            </Card>
          </section>

          <div className="border border-border bg-card p-6">
            <p className="mb-5 text-xs font-medium uppercase tracking-wider text-muted-foreground">Current stage counts</p>
            <div className="space-y-3">
              {STATUS_ORDER.filter((s) => !["rejected", "withdrawn", "ghosted"].includes(s)).map((status) => {
                const n = countsByStatus[status]
                const pct = maxCount > 0 ? Math.max(4, Math.round((n / maxCount) * 100)) : 4
                return (
                  <div key={status} className="flex items-center gap-4">
                    <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{STATUS_LABELS[status]}</span>
                    <div className="relative flex-1">
                      <div className={cn("h-8 border transition-all", STATUS_COLORS[status])} style={{ width: `${pct}%`, minWidth: "2rem" }} />
                    </div>
                    <span className="w-8 shrink-0 text-sm font-medium">{n}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-5 flex gap-8 border-t border-border pt-4">
              {(["rejected", "withdrawn", "ghosted"] as ApplicationStatus[]).map((s) => (
                <div key={s}>
                  <p className="text-xs text-muted-foreground">{STATUS_LABELS[s]}</p>
                  <p className="font-heading text-2xl">{countsByStatus[s]}</p>
                </div>
              ))}
              {avgDaysToApply !== null && (
                <div className="ml-auto">
                  <p className="text-xs text-muted-foreground">Avg. days saved &gt; applied</p>
                  <p className="font-heading text-2xl">{avgDaysToApply}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Source breakdown */}
      {emptyState !== "no-applications" && topSources.length > 0 && (
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

function PipelineMetricCard({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <Card className="bg-card py-5">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="metric-label">{label}</span>
          <Sigma className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <div className="font-heading text-[2.7rem] leading-none tracking-[-0.05em] text-foreground">
            {value}
          </div>
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function formatShare(value: number, total: number) {
  if (total <= 0) return "0%"
  return `${Math.round((value / total) * 100)}%`
}
