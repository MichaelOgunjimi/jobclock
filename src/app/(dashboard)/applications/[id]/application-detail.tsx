"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-styles"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { updateStatus, updateNotes, updateCv, updateCoverLetter } from "./actions"
import type { ApplicationStatus, Database } from "@/lib/supabase/database.types"

type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"]
type JobsCacheRow = Database["public"]["Tables"]["jobs_cache"]["Row"]
type UserCvRow = Pick<
  Database["public"]["Tables"]["user_cvs"]["Row"],
  "id" | "name" | "is_primary" | "created_at"
>
type CoverLetterRow = Pick<
  Database["public"]["Tables"]["cover_letters"]["Row"],
  "id" | "label" | "tone"
>

interface ApplicationWithJob extends ApplicationRow {
  jobs_cache: JobsCacheRow | null
}

interface Props {
  application: ApplicationWithJob
  cvs: UserCvRow[]
  coverLetters: CoverLetterRow[]
}

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_STEPS: { value: ApplicationStatus; label: string; num: string }[] =
  [
    { value: "saved", label: "Saved", num: "01" },
    { value: "applied", label: "Applied", num: "02" },
    { value: "screening", label: "Screening", num: "03" },
    { value: "interview", label: "Interview", num: "04" },
    { value: "offer", label: "Offer", num: "05" },
  ]

const ALL_STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
]

function getStatusBadgeClass(status: ApplicationStatus): string {
  switch (status) {
    case "saved":
      return "border-border bg-secondary text-foreground"
    case "applied":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
    case "screening":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
    case "interview":
      return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300"
    case "offer":
      return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
    case "rejected":
      return "border-destructive/20 bg-destructive/10 text-destructive"
    case "withdrawn":
      return "border-border bg-secondary text-muted-foreground opacity-70"
    default:
      return "border-border bg-secondary text-foreground"
  }
}

function getStatusLabel(status: ApplicationStatus): string {
  return ALL_STATUSES.find((s) => s.value === status)?.label ?? status
}

// ── Pipeline stepper ────────────────────────────────────────────────────────

function StatusStepper({ currentStatus }: { currentStatus: ApplicationStatus }) {
  const isTerminal =
    currentStatus === "rejected" || currentStatus === "withdrawn"
  const currentIndex = STATUS_STEPS.findIndex((s) => s.value === currentStatus)

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:hidden">
        {STATUS_STEPS.map((step, index) => {
          const isPast = !isTerminal && index < currentIndex
          const isCurrent = !isTerminal && index === currentIndex
          const isFuture = isTerminal || index > currentIndex

          return (
            <div
              key={step.value}
              className={cn(
                "flex items-center justify-between border px-4 py-3 transition-colors",
                isCurrent &&
                  "border-foreground bg-foreground text-background",
                isPast &&
                  "border-foreground/30 bg-secondary/60 text-foreground",
                isFuture && "border-border bg-background text-muted-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold tracking-[0.1em] opacity-60">
                  {step.num}
                </span>
                <span className="text-[11px] font-semibold tracking-[0.06em] uppercase">
                  {step.label}
                </span>
              </div>
              {isCurrent && <span className="text-[10px] font-semibold tracking-[0.1em] uppercase">current</span>}
            </div>
          )
        })}
      </div>

      <div className="hidden items-stretch gap-0 sm:flex">
        {STATUS_STEPS.map((step, index) => {
          const isPast = !isTerminal && index < currentIndex
          const isCurrent = !isTerminal && index === currentIndex
          const isFuture = isTerminal || index > currentIndex

          return (
            <div
              key={step.value}
              className={cn(
                "flex flex-1 flex-col gap-1.5 border px-3 py-3 text-center transition-colors",
                index !== 0 && "-ml-px",
                isCurrent &&
                  "relative z-10 border-foreground bg-foreground text-background",
                isPast &&
                  "border-foreground/30 bg-secondary/60 text-foreground",
                isFuture && "border-border bg-background text-muted-foreground"
              )}
            >
              <span className="text-[10px] font-semibold tracking-[0.1em] opacity-60">
                {step.num}
              </span>
              <span className="text-[11px] font-semibold tracking-[0.06em] uppercase">
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      {isTerminal && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Badge className={getStatusBadgeClass(currentStatus)}>
            {getStatusLabel(currentStatus)}
          </Badge>
          <span className="text-[13px] text-muted-foreground">
            This application is no longer active.
          </span>
        </div>
      )}
    </div>
  )
}

// ── Status update form ───────────────────────────────────────────────────────

function StatusUpdateForm({
  applicationId,
  currentStatus,
}: {
  applicationId: string
  currentStatus: ApplicationStatus
}) {
  const [pending, startTransition] = useTransition()
  const [selectedStatus, setSelectedStatus] = useState(currentStatus)

  useEffect(() => {
    setSelectedStatus(currentStatus)
  }, [currentStatus])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(() => updateStatus(formData))
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input type="hidden" name="applicationId" value={applicationId} />
      <Label htmlFor="status-select" className="text-sm">
        Move to
      </Label>
      <select
        id="status-select"
        name="status"
        value={selectedStatus}
        onChange={(e) => setSelectedStatus(e.target.value as ApplicationStatus)}
        className="form-select min-w-0 bg-background sm:min-w-[12rem]"
      >
        {ALL_STATUSES.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="default" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving…" : "Update"}
      </Button>
    </form>
  )
}

// ── Notes card ───────────────────────────────────────────────────────────────

function NotesCard({
  applicationId,
  initialNotes,
}: {
  applicationId: string
  initialNotes: string | null
}) {
  const [notes, setNotes] = useState(initialNotes ?? "")
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(() => updateNotes(formData))
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="hidden" name="applicationId" value={applicationId} />
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[120px] w-full border border-input bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            placeholder="Add private notes about this application…"
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? "Saving…" : "Save notes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ── CV card ──────────────────────────────────────────────────────────────────

function CvCard({
  applicationId,
  cvs,
  currentCvId,
}: {
  applicationId: string
  cvs: UserCvRow[]
  currentCvId: string | null
}) {
  const primaryCv = cvs.find((cv) => cv.is_primary)
  const defaultValue = currentCvId ?? primaryCv?.id ?? ""
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(() => updateCv(formData))
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Base CV</CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="applicationId" value={applicationId} />
          <div className="flex-1 space-y-1.5 min-w-0">
            <Label htmlFor="cv-select">Select CV</Label>
            <select
              id="cv-select"
              name="cvId"
              defaultValue={defaultValue}
              className="form-select bg-background"
            >
              <option value="">— None —</option>
              {cvs.map((cv) => (
                <option key={cv.id} value={cv.id}>
                  {cv.name ?? "Untitled CV"}
                  {cv.is_primary ? " (primary)" : ""}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="default" variant="outline" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Saving…" : "Save"}
          </Button>
        </form>
        <p className="text-[12px] text-muted-foreground">
          Tailored CV generation — coming soon
        </p>
      </CardContent>
    </Card>
  )
}

// ── Cover letter card ────────────────────────────────────────────────────────

function CoverLetterCard({
  applicationId,
  coverLetters,
  currentCoverLetterId,
}: {
  applicationId: string
  coverLetters: CoverLetterRow[]
  currentCoverLetterId: string | null
}) {
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(() => updateCoverLetter(formData))
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Cover Letter</CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="applicationId" value={applicationId} />
          <div className="flex-1 space-y-1.5 min-w-0">
            <Label htmlFor="cover-letter-select">Select template</Label>
            <select
              id="cover-letter-select"
              name="coverLetterId"
              defaultValue={currentCoverLetterId ?? ""}
              className="form-select bg-background"
            >
              <option value="">— None —</option>
              {coverLetters.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.label ?? "Untitled"}
                  {cl.tone ? ` · ${cl.tone}` : ""}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="default" variant="outline" disabled={pending} className="w-full sm:w-auto">
            {pending ? "Saving…" : "Save"}
          </Button>
        </form>
        <p className="text-[12px] text-muted-foreground">
          AI cover letter generation — coming soon
        </p>
      </CardContent>
    </Card>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export function ApplicationDetail({ application, cvs, coverLetters }: Props) {
  const job = application.jobs_cache

  const salaryText =
    job?.salary_min != null
      ? `£${Number(job.salary_min).toLocaleString()}${
          job.salary_max != null
            ? ` – £${Number(job.salary_max).toLocaleString()}`
            : ""
        }`
      : null

  const postedAt = job?.posted_at
      ? new Date(job.posted_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
    : null

  const sourceLabel = job?.source
    ? job.source.charAt(0).toUpperCase() + job.source.slice(1)
    : null

  const detailItems = [
    postedAt ? { label: "Posted", value: postedAt } : null,
    sourceLabel ? { label: "Source", value: sourceLabel } : null,
    application.created_at
      ? {
          label: "Saved",
          value: new Date(application.created_at).toLocaleDateString(
            "en-GB",
            { day: "numeric", month: "short", year: "numeric" }
          ),
        }
      : null,
    application.applied_at
      ? {
          label: "Applied",
          value: new Date(application.applied_at).toLocaleDateString(
            "en-GB",
            { day: "numeric", month: "short", year: "numeric" }
          ),
        }
      : null,
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div className="page-shell">
      {/* Page header */}
      <div className="page-header">
        <div className="space-y-3">
          <p className="page-kicker">Application</p>
          <div className="space-y-2">
            <h1 className="page-title">{job?.title ?? "Unknown Role"}</h1>
            <p className="page-lede">
              {[job?.company, job?.location].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {salaryText && (
              <span className="text-sm text-muted-foreground">{salaryText}</span>
            )}
            <Badge className={getStatusBadgeClass(application.status)}>
              {getStatusLabel(application.status)}
            </Badge>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/applications"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full justify-center sm:w-auto")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to pipeline
          </Link>
          {job?.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-center sm:w-auto")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View posting
            </a>
          )}
        </div>
      </div>

      {/* Status pipeline */}
      <Card>
        <CardContent className="space-y-5 pt-5 pb-5 sm:pt-6">
          <StatusStepper currentStatus={application.status} />
          <div className="border-t pt-4">
            <StatusUpdateForm
              applicationId={application.id}
              currentStatus={application.status}
            />
          </div>
        </CardContent>
      </Card>

      {/* Two-column content */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        {/* Left column */}
        <div className="space-y-6">
          {/* Job description */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Job Description</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              {job?.description ? (
                <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                  {job.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No description available for this role.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Details */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {detailItems.map((item) => (
                  <div key={item.label} className="border border-border bg-secondary/35 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">{item.value}</p>
                  </div>
                ))}
                {job?.is_easy_apply != null && (
                  <div className="border border-border bg-secondary/35 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Easy Apply
                    </p>
                    <div className="mt-2">
                      <Badge
                        className={
                          job.is_easy_apply
                            ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                            : "border-border bg-secondary text-foreground"
                        }
                      >
                        {job.is_easy_apply ? "Yes" : "No"}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
              {job?.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 block break-all text-[12px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  {job.url}
                </a>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <CvCard
            applicationId={application.id}
            cvs={cvs}
            currentCvId={application.customized_cv_id}
          />
          <CoverLetterCard
            applicationId={application.id}
            coverLetters={coverLetters}
            currentCoverLetterId={application.cover_letter_id}
          />
          <NotesCard
            applicationId={application.id}
            initialNotes={application.notes}
          />
        </div>
      </div>
    </div>
  )
}
