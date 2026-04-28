import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Briefcase,
  CalendarDays,
  ChevronDown,
  CircleDot,
  MapPin,
  Plus,
  Wallet,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button-styles"
import type { ApplicationStatus, Database } from "@/lib/supabase/database.types"
import { ApplicationsFilterBar } from "./applications-filter-bar"

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
])

const APPLICATIONS_PER_PAGE = 8

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; status?: string; sort?: string }>
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
    redirect(buildApplicationsPageHref(safeCurrentPage, activeStatus, activeSort))
  }

  const statusOptions: {
    value: ApplicationStatus
    label: string
    color: string
    dot: string
  }[] = [
    {
      value: "saved",
      label: "Saved",
      color: "border-border bg-secondary/70 text-foreground",
      dot: "bg-foreground/55",
    },
    {
      value: "applied",
      label: "Applied",
      color: "border-sky-200/80 bg-sky-50/70 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200",
      dot: "bg-sky-500 dark:bg-sky-400",
    },
    {
      value: "screening",
      label: "Screening",
      color: "border-amber-200/80 bg-amber-50/70 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200",
      dot: "bg-amber-500 dark:bg-amber-400",
    },
    {
      value: "interview",
      label: "Interview",
      color: "border-violet-200/80 bg-violet-50/70 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-200",
      dot: "bg-violet-500 dark:bg-violet-400",
    },
    {
      value: "offer",
      label: "Offer",
      color: "border-emerald-200/80 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200",
      dot: "bg-emerald-500 dark:bg-emerald-400",
    },
    {
      value: "rejected",
      label: "Rejected",
      color: "border-rose-200/80 bg-rose-50/70 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200",
      dot: "bg-rose-500 dark:bg-rose-400",
    },
    {
      value: "withdrawn",
      label: "Withdrawn",
      color: "border-border bg-muted/70 text-muted-foreground",
      dot: "bg-muted-foreground/70",
    },
  ]

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
        <div className="section-label">Pipeline overview</div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          {statusOptions.map((opt, index) => (
            <Card key={opt.value} className="bg-card py-4">
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
                    <p className="text-[13px] text-muted-foreground">
                      {opt.value === "saved" && "Roles you want to revisit and tailor."}
                      {opt.value === "applied" && "Applications already sent and awaiting movement."}
                      {opt.value === "screening" && "Initial recruiter or hiring-team conversations."}
                      {opt.value === "interview" && "Live interview stages now in progress."}
                      {opt.value === "offer" && "Offers that need review or response."}
                      {opt.value === "rejected" && "Closed outcomes for record-keeping."}
                      {opt.value === "withdrawn" && "Roles you intentionally stepped away from."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {applications.length === 0 ? (
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
          />
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
                  href={buildApplicationsPageHref(Math.max(1, safeCurrentPage - 1), activeStatus, activeSort)}
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
                      href={buildApplicationsPageHref(entry, activeStatus, activeSort)}
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
                  href={buildApplicationsPageHref(Math.min(totalPages, safeCurrentPage + 1), activeStatus, activeSort)}
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
        </div>
      )}
    </div>
  )
}

function buildApplicationsPageHref(page: number, status?: string, sort?: string) {
  const params = new URLSearchParams()
  if (page > 1) params.set("page", String(page))
  if (status && status !== "all") params.set("status", status)
  if (sort && sort !== "saved_desc") params.set("sort", sort)
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

function ApplicationStatusForm({
  applicationId,
  currentStatus,
  statusOptions,
}: {
  applicationId: string
  currentStatus: string
  statusOptions: { value: string; label: string; color: string; dot: string }[]
}) {
  return (
    <form
      action={updateApplicationStatus}
      className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"
    >
      <input type="hidden" name="applicationId" value={applicationId} />
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Application status
        </Label>
        <p className="text-sm text-muted-foreground">
          Move this role to its next stage and keep the pipeline current.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Stage
          </Label>
          <div className="relative">
            <CircleDot className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <ChevronDown className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <select
              name="status"
              defaultValue={currentStatus}
              className="form-select min-w-[15rem] bg-none pl-10 pr-14"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button type="submit" size="default" className="w-full sm:w-auto">
          Update stage
        </Button>
      </div>
    </form>
  )
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

  const updates: Database["public"]["Tables"]["applications"]["Update"] = {
    status: status as ApplicationStatus,
    last_status_update: new Date().toISOString(),
  }

  if (status === "applied" && !updates.applied_at) {
    updates.applied_at = new Date().toISOString()
  }

  await supabase
    .from("applications")
    .update(updates)
    .eq("id", applicationId)
    .eq("user_id", user.id)

  revalidatePath("/applications")
  revalidatePath(`/applications/${applicationId}`)
  revalidatePath("/dashboard")
}
