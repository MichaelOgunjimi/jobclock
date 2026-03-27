import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Briefcase, Plus } from "lucide-react"
import Link from "next/link"
import type { ApplicationStatus, Database } from "@/lib/supabase/database.types"

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

export default async function ApplicationsPage() {
  if (!isSupabaseConfigured()) {
    redirect("/auth")
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth")
  }

  const { data: applicationsData } = await supabase
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
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const applications = (applicationsData ?? []) as ApplicationWithJob[]

  const statusOptions: { value: ApplicationStatus; label: string; color: string }[] = [
    { value: "saved", label: "Saved", color: "border-border bg-secondary text-foreground" },
    { value: "applied", label: "Applied", color: "border-border bg-secondary text-foreground" },
    { value: "screening", label: "Screening", color: "border-border bg-secondary text-foreground" },
    { value: "interview", label: "Interview", color: "border-border bg-secondary text-foreground" },
    { value: "offer", label: "Offer", color: "border-border bg-secondary text-foreground" },
    { value: "rejected", label: "Rejected", color: "border-border bg-secondary text-foreground" },
    { value: "withdrawn", label: "Withdrawn", color: "border-border bg-secondary text-muted-foreground" },
  ]

  const statusCounts = applications.reduce(
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
        <Button asChild>
          <Link href="/jobs">
            <Plus className="h-4 w-4" />
            Find roles
          </Link>
        </Button>
      </div>

      <div className="space-y-4">
        <div className="section-label">Pipeline overview</div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          {statusOptions.map((opt, index) => (
            <Card key={opt.value} className="bg-card py-4">
              <CardContent className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <span className="metric-label">{String(index + 1).padStart(2, "0")}</span>
                  <div className="flex h-8 min-w-8 items-center justify-center border bg-secondary px-2 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    {opt.label.slice(0, 2)}
                  </div>
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
            <Button asChild className="mt-4">
              <Link href="/jobs">Browse Jobs</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const statusConfig = statusOptions.find((s) => s.value === app.status)
            const statusColor = statusConfig?.color ?? "border-border bg-secondary text-muted-foreground"

            return (
              <Card key={app.id} className="transition-colors hover:bg-secondary/70">
                <CardHeader className="border-b pb-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-[1.5rem]">
                        {app.jobs_cache?.title ?? "Unknown Job"}
                      </CardTitle>
                      <CardDescription className="mt-2 flex items-center gap-2">
                        {app.jobs_cache?.company ?? "Unknown Company"}
                        {app.jobs_cache?.location && (
                          <> &middot; {app.jobs_cache.location}</>
                        )}
                      </CardDescription>
                    </div>
                    <Badge className={statusColor}>{statusConfig?.label ?? app.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    {app.jobs_cache?.salary_min && (
                      <span>
                        &pound;{app.jobs_cache.salary_min.toLocaleString()}
                        {app.jobs_cache.salary_max
                          ? ` - &pound;${app.jobs_cache.salary_max.toLocaleString()}`
                          : ""}
                      </span>
                    )}
                    <span>
                      Saved {new Date(app.created_at).toLocaleDateString()}
                    </span>
                    {app.applied_at && (
                      <span>
                        Applied {new Date(app.applied_at).toLocaleDateString()}
                      </span>
                    )}
                    {app.source && <span>Source: {app.source}</span>}
                  </div>

                  {app.notes && (
                    <p className="border-l-2 border-accent pl-4 text-sm text-muted-foreground italic">
                      {app.notes}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {app.jobs_cache?.url && (
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={app.jobs_cache.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View original posting
                        </a>
                      </Button>
                    )}
                    <ApplicationStatusForm
                      applicationId={app.id}
                      currentStatus={app.status}
                      statusOptions={statusOptions}
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ApplicationStatusForm({
  applicationId,
  currentStatus,
  statusOptions,
}: {
  applicationId: string
  currentStatus: string
  statusOptions: { value: string; label: string; color: string }[]
}) {
  return (
    <form action={updateApplicationStatus} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <Label className="text-xs">Status:</Label>
      <select
        name="status"
        defaultValue={currentStatus}
        className="h-10 min-w-[10rem] border border-input bg-background px-3 text-xs"
      >
        {statusOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="ghost">
        Update
      </Button>
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

  // Re-fetch to check if this is now an interview status
  // In Phase 2, we would trigger interview prep generation here
}
