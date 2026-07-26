import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Briefcase,
  Search,
  ArrowRight,
  CalendarDays,
  MapPin,
  Plus,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button-styles"
import type { ApplicationStatus, Database } from "@/lib/supabase/database.types"
import { updateApplicationStatusForUser } from "@/lib/jobs/persist-job"
import { ApplicationsFilterBar } from "./applications-filter-bar"
import { ApplicationStatusForm } from "./application-status-form"
import { APPLICATION_STATUS_OPTIONS } from "./pipeline-metrics"

export const metadata: Metadata = {
  title: "Applications",
}

type ApplicationWithJob = Database["public"]["Tables"]["applications"]["Row"] & {
  jobs_cache: Pick<
    Database["public"]["Tables"]["jobs_cache"]["Row"],
    "id" | "title" | "company" | "location" | "url" | "salary_min" | "salary_max"
  > | null
}

const VALID_APPLICATION_STATUSES = new Set<ApplicationStatus>([
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
  "ghosted",
])

const APPLICATIONS_PER_PAGE = 8

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; status?: string; sort?: string; q?: string }>
}) {
  if (!isSupabaseConfigured()) {
    redirect("/auth")
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined

  const currentPage = Math.max(1, Number(resolvedSearchParams?.page ?? "1") || 1)

  // Filter param — validate against known statuses
  const rawStatus = resolvedSearchParams?.status ?? ""
  const activeStatus: ApplicationStatus | "all" =
    rawStatus && VALID_APPLICATION_STATUSES.has(rawStatus as ApplicationStatus)
      ? (rawStatus as ApplicationStatus)
      : "all"

  // Sort param
  const VALID_SORTS = new Set(["saved_desc", "saved_asc", "applied_desc", "company_asc"])
  const rawSort = resolvedSearchParams?.sort ?? ""
  const activeSort = VALID_SORTS.has(rawSort) ? rawSort : "saved_desc"

  // Search param
  const activeSearch = (resolvedSearchParams?.q ?? "").trim().slice(0, 100)

  const rangeStart = (currentPage - 1) * APPLICATIONS_PER_PAGE
  const rangeEnd = rangeStart + APPLICATIONS_PER_PAGE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  // Base query
  let query = supabase
    .from("applications")
    .select(`
      id,
      status,
      created_at,
      applied_at,
      source,
      notes,
      tags,
      jobs_cache (
        id,
        title,
        company,
        location,
        url,
        salary_min,
        salary_max
      )
    `, { count: "exact" })
    .eq("user_id", user.id)

  // Apply status filter
  if (activeStatus !== "all") {
    query = query.eq("status", activeStatus)
  }

  // Apply search — find matching job IDs first, then filter applications.
  // Strip chars that would break PostgREST or() filter syntax (comma, parens).
  if (activeSearch) {
    const escaped = activeSearch.replace(/[,()']/g, " ")
    const { data: matchingJobs, error: searchError } = await supabase
      .from("jobs_cache")
      .select("id")
      .or(`title.ilike.%${escaped}%,company.ilike.%${escaped}%`)
    if (!searchError) {
      const jobIds = matchingJobs?.map((j) => j.id) ?? []
      query = jobIds.length > 0
        ? query.in("job_id", jobIds)
        : query.in("job_id", ["00000000-0000-0000-0000-000000000000"]) // force empty
    }
    // On search error: skip the filter and show all results rather than hiding everything
  }

  // Apply sort
  if (activeSort === "saved_asc") {
    query = query.order("created_at", { ascending: true })
  } else if (activeSort === "applied_desc") {
    query = query.order("applied_at", { ascending: false, nullsFirst: false })
  } else {
    query = query.order("created_at", { ascending: false })
  }

  const [
    { data: applicationsData, count: totalApplications },
    { data: applicationStatuses },
  ] = await Promise.all([
    query.range(rangeStart, rangeEnd),
    supabase
      .from("applications")
      .select("status")
      .eq("user_id", user.id),
  ])

  let applications = (applicationsData ?? []) as ApplicationWithJob[]

  // Company A–Z sort happens post-fetch (joined field, can't ORDER BY in Supabase easily)
  if (activeSort === "company_asc") {
    applications = [...applications].sort((a, b) =>
      (a.jobs_cache?.company ?? "").localeCompare(b.jobs_cache?.company ?? "")
    )
  }

  const totalPages = Math.max(1, Math.ceil((totalApplications ?? 0) / APPLICATIONS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  if ((totalApplications ?? 0) > 0 && currentPage !== safeCurrentPage) {
    redirect(buildApplicationsPageHref(safeCurrentPage, activeStatus, activeSort, activeSearch))
  }

  const statusOptions = APPLICATION_STATUS_OPTIONS
  const totalPipelineApplications = (applicationStatuses ?? []).length

  const statusCounts = (applicationStatuses ?? []).reduce(
    (acc, app) => {
      acc[app.status] = (acc[app.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="space-y-3">
          <p className="page-kicker">Pipeline</p>
          <div className="space-y-2">
            <h1 className="page-title">Every application in one clear sequence.</h1>
            <p className="page-lede max-w-2xl">
              Review the full application pipeline, move statuses deliberately, and keep decisions visible.
            </p>
          </div>
        </div>
        <Link href="/jobs" className={buttonVariants({ size: "default" })}>
            <Plus className="h-4 w-4" />
            Find roles
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="section-label">Pipeline overview</div>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Open analytics
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
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
                    {totalPipelineApplications}
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
          {statusOptions.map((opt, index) => (
            <Link
              key={opt.value}
              href={`/analytics?status=${opt.value}`}
              className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
            >
              <Card className="h-full bg-card py-4 transition-[border-color,box-shadow] group-hover:border-foreground/20 group-hover:shadow-[0_18px_34px_-30px_rgba(10,10,10,0.4)]">
                <CardContent className="space-y-4 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="metric-label">{String(index + 1).padStart(2, "0")}</span>
                    <Badge className={cn("h-8 gap-2 px-3 text-[10px] tracking-[0.12em]", opt.color)}>
                      <span className={cn("size-1.5 rounded-full", opt.dot)} />
                      {opt.label}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="font-heading text-[2.2rem] leading-none tracking-[-0.05em] text-foreground">
                      {statusCounts[opt.value] ?? 0}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium tracking-[0.02em]">{opt.label}</p>
                      <p className="text-[13px] text-muted-foreground">{opt.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {(applicationStatuses ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground">
            <Briefcase className="mx-auto mb-4 h-10 w-10" />
            <p className="text-lg font-medium text-foreground">No applications yet</p>
            <p className="mt-2 text-sm">Save jobs from search results to start building your pipeline.</p>
            <Link href="/jobs" className={cn(buttonVariants({ size: "default" }), "mt-4 inline-flex")}>
              Browse Jobs
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <ApplicationsFilterBar
            counts={statusCounts}
            total={totalApplications ?? 0}
            activeStatus={activeStatus}
            activeSort={activeSort}
            activeSearch={activeSearch}
          />
          {applications.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Search className="mx-auto mb-3 h-8 w-8" />
                <p className="font-medium text-foreground">No results</p>
                <p className="mt-1 text-sm">No applications match your search or filter.</p>
              </CardContent>
            </Card>
          ) : (
            <>
          <div className="flex flex-col gap-2 border border-border bg-secondary/35 px-5 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing{" "}
              <span className="font-medium text-foreground">
                {rangeStart + 1}-{Math.min(rangeStart + applications.length, totalApplications ?? applications.length)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">
                {(totalApplications ?? applications.length).toLocaleString()}
              </span>{" "}
              {activeStatus !== "all" ? `${activeStatus} ` : ""}applications
            </p>
            <p>
              Page{" "}
              <span className="font-medium text-foreground">{safeCurrentPage}</span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{totalPages}</span>
            </p>
          </div>

          {applications.map((app) => {
            const statusConfig = statusOptions.find((s) => s.value === app.status)
            const statusColor = statusConfig?.color ?? "border-border bg-secondary text-muted-foreground"
            const statusDot = statusConfig?.dot ?? "bg-muted-foreground"
            const salaryLabel = app.jobs_cache?.salary_min
              ? `£${app.jobs_cache.salary_min.toLocaleString()}${app.jobs_cache.salary_max
                ? ` - £${app.jobs_cache.salary_max.toLocaleString()}`
                : ""}`
              : null

            return (
              <Card
                key={app.id}
                className="group relative gap-0 overflow-hidden border-border/90 bg-card py-0 transition-[border-color,box-shadow] hover:border-foreground/15 hover:shadow-[0_20px_36px_-32px_rgba(10,10,10,0.24)]"
              >
                <Link
                  href={`/applications/${app.id}`}
                  aria-label={`Open application for ${app.jobs_cache?.title ?? "job"}`}
                  className="absolute inset-0 z-0"
                />

                <div className="space-y-0">
                  <div className="pointer-events-none space-y-5 px-6 py-6 sm:px-7">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          <span>{app.jobs_cache?.company ?? "Unknown Company"}</span>
                          {app.source && (
                            <>
                              <span className="text-border">/</span>
                              <span>via {app.source}</span>
                            </>
                          )}
                        </div>
                        <CardTitle className="max-w-3xl text-[1.45rem] leading-[1.04] transition-colors group-hover:text-foreground/82 sm:text-[1.65rem]">
                          {app.jobs_cache?.title ?? "Unknown Job"}
                        </CardTitle>
                      </div>

                      <Badge className={cn("h-9 gap-2 self-start px-3.5 text-[10px] tracking-[0.12em]", statusColor)}>
                        <span className={cn("size-1.5 rounded-full", statusDot)} />
                        {statusConfig?.label ?? app.status}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
                      {app.jobs_cache?.location && (
                        <span className="inline-flex items-center gap-1.5 border border-border bg-secondary/45 px-3 py-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {app.jobs_cache.location}
                        </span>
                      )}
                      {salaryLabel && (
                        <span className="inline-flex items-center gap-1.5 border border-border bg-secondary/45 px-3 py-1.5">
                          <Wallet className="h-3.5 w-3.5" />
                          {salaryLabel}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 border border-border bg-secondary/45 px-3 py-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Saved {new Date(app.created_at).toLocaleDateString()}
                      </span>
                      {app.applied_at && (
                        <span className="inline-flex items-center gap-1.5 border border-border bg-secondary/45 px-3 py-1.5">
                          Applied {new Date(app.applied_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {app.notes && (
                      <div className="border border-border bg-secondary/30 px-4 py-3">
                        <p className="text-sm leading-6 text-muted-foreground">{app.notes}</p>
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {Array.isArray(app.tags) && app.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {app.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Keep the stage current so the pipeline stays useful.
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        {app.jobs_cache?.url && (
                          <a
                            href={app.jobs_cache.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              buttonVariants({ size: "sm", variant: "outline" }),
                              "pointer-events-auto relative z-20 w-full sm:w-auto"
                            )}
                          >
                            View posting
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pointer-events-auto relative z-20 border-t border-border bg-secondary/35 px-6 py-5 sm:px-7">
                    <ApplicationStatusForm
                      applicationId={app.id}
                      currentStatus={app.status}
                      statusOptions={statusOptions}
                      action={updateApplicationStatus}
                    />
                  </div>
                </div>
              </Card>
            )
          })}

          {totalPages > 1 && (
            <nav
              aria-label="Applications pagination"
              className="flex flex-col gap-3 border border-border bg-secondary/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-sm text-muted-foreground">
                Move through your application history without losing the current sort.
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={buildApplicationsPageHref(Math.max(1, safeCurrentPage - 1), activeStatus, activeSort, activeSearch)}
                  aria-disabled={safeCurrentPage === 1}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    safeCurrentPage === 1 && "pointer-events-none opacity-40"
                  )}
                >
                  Previous
                </Link>
                {getVisiblePages(safeCurrentPage, totalPages).map((entry, index) =>
                  entry === "ellipsis" ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-2 text-sm text-muted-foreground"
                    >
                      …
                    </span>
                  ) : (
                    <Link
                      key={entry}
                      href={buildApplicationsPageHref(entry, activeStatus, activeSort, activeSearch)}
                      className={cn(
                        buttonVariants({
                          variant: entry === safeCurrentPage ? "default" : "outline",
                          size: "sm",
                        })
                      )}
                      aria-current={entry === safeCurrentPage ? "page" : undefined}
                    >
                      {entry}
                    </Link>
                  )
                )}
                <Link
                  href={buildApplicationsPageHref(Math.min(totalPages, safeCurrentPage + 1), activeStatus, activeSort, activeSearch)}
                  aria-disabled={safeCurrentPage === totalPages}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    safeCurrentPage === totalPages && "pointer-events-none opacity-40"
                  )}
                >
                  Next
                </Link>
              </div>
            </nav>
          )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function buildApplicationsPageHref(page: number, status?: string, sort?: string, q?: string) {
  const params = new URLSearchParams()
  if (page > 1) params.set("page", String(page))
  if (status && status !== "all") params.set("status", status)
  if (sort && sort !== "saved_desc") params.set("sort", sort)
  if (q) params.set("q", q)
  const qs = params.toString()
  return qs ? `/applications?${qs}` : "/applications"
}

function getVisiblePages(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages]
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages]
}

async function updateApplicationStatus(formData: FormData) {
  "use server"

  if (!isSupabaseConfigured()) {
    return
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return

  const applicationId = formData.get("applicationId") as string
  const status = formData.get("status")

  if (typeof status !== "string" || !VALID_APPLICATION_STATUSES.has(status as ApplicationStatus)) {
    return
  }

  await updateApplicationStatusForUser(user.id, applicationId, status as ApplicationStatus)

  revalidatePath("/applications")
  revalidatePath(`/applications/${applicationId}`)
  revalidatePath("/dashboard")
}
