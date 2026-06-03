import type { ApplicationStatus } from "@/lib/supabase/database.types"

export interface ApplicationStatusOption {
  value: ApplicationStatus
  label: string
  description: string
  color: string
  dot: string
  sankeyColor: string
  group: "active" | "closed"
}

export const APPLICATION_STATUS_OPTIONS: ApplicationStatusOption[] = [
  {
    value: "saved",
    label: "Saved",
    description: "Roles you want to revisit and tailor.",
    color: "border-border bg-secondary/70 text-foreground",
    dot: "bg-foreground/55",
    sankeyColor: "#9ca3af",
    group: "active",
  },
  {
    value: "applied",
    label: "Applied",
    description: "Applications already sent and awaiting movement.",
    color: "border-sky-200/80 bg-sky-50/70 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-200",
    dot: "bg-sky-500 dark:bg-sky-400",
    sankeyColor: "#0ea5e9",
    group: "active",
  },
  {
    value: "screening",
    label: "Screening",
    description: "Initial recruiter or hiring-team conversations.",
    color: "border-amber-200/80 bg-amber-50/70 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200",
    dot: "bg-amber-500 dark:bg-amber-400",
    sankeyColor: "#f59e0b",
    group: "active",
  },
  {
    value: "interview",
    label: "Interview",
    description: "Live interview stages now in progress.",
    color: "border-violet-200/80 bg-violet-50/70 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-200",
    dot: "bg-violet-500 dark:bg-violet-400",
    sankeyColor: "#8b5cf6",
    group: "active",
  },
  {
    value: "offer",
    label: "Offer",
    description: "Offers that need review or response.",
    color: "border-emerald-200/80 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200",
    dot: "bg-emerald-500 dark:bg-emerald-400",
    sankeyColor: "#10b981",
    group: "active",
  },
  {
    value: "rejected",
    label: "Rejected",
    description: "Closed outcomes for record-keeping.",
    color: "border-rose-200/80 bg-rose-50/70 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-200",
    dot: "bg-rose-500 dark:bg-rose-400",
    sankeyColor: "#f43f5e",
    group: "closed",
  },
  {
    value: "withdrawn",
    label: "Withdrawn",
    description: "Roles you intentionally stepped away from.",
    color: "border-border bg-muted/70 text-muted-foreground",
    dot: "bg-muted-foreground/70",
    sankeyColor: "#6b7280",
    group: "closed",
  },
  {
    value: "ghosted",
    label: "Ghosted",
    description: "Roles with no reply after your follow-up window.",
    color: "border-fuchsia-200/80 bg-fuchsia-50/70 text-fuchsia-800 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/20 dark:text-fuchsia-200",
    dot: "bg-fuchsia-500 dark:bg-fuchsia-400",
    sankeyColor: "#d946ef",
    group: "closed",
  },
]

export const APPLICATION_STATUS_VALUES = APPLICATION_STATUS_OPTIONS.map((option) => option.value)

export type PipelineStatusCounts = Record<ApplicationStatus, number>

export interface PipelineMetrics {
  total: number
  active: number
  closed: number
  sent: number
  advanced: number
  statusCounts: PipelineStatusCounts
}

export interface PipelineFlowEvent {
  fromStatus: string | null
  toStatus: string | null
}

export interface PipelineFlowLink {
  from: ApplicationStatus
  to: ApplicationStatus
  count: number
}

export function buildPipelineMetrics(rows: Array<{ status: string | null }>): PipelineMetrics {
  const statusCounts = Object.fromEntries(
    APPLICATION_STATUS_VALUES.map((status) => [status, 0])
  ) as PipelineStatusCounts

  for (const row of rows) {
    if (isApplicationStatus(row.status)) {
      statusCounts[row.status] += 1
    }
  }

  const total = APPLICATION_STATUS_VALUES.reduce((sum, status) => sum + statusCounts[status], 0)
  const active = APPLICATION_STATUS_OPTIONS
    .filter((option) => option.group === "active")
    .reduce((sum, option) => sum + statusCounts[option.value], 0)
  const closed = total - active
  const sent = statusCounts.applied + statusCounts.screening + statusCounts.interview + statusCounts.offer
  const advanced = statusCounts.screening + statusCounts.interview + statusCounts.offer

  return { total, active, closed, sent, advanced, statusCounts }
}

export function isApplicationStatus(value: string | null): value is ApplicationStatus {
  return APPLICATION_STATUS_VALUES.includes(value as ApplicationStatus)
}

export function getApplicationStatusOption(value: string | null) {
  if (!isApplicationStatus(value)) return null
  return APPLICATION_STATUS_OPTIONS.find((option) => option.value === value) ?? null
}

export function buildPipelineFlowMetrics(events: PipelineFlowEvent[]) {
  const counts = new Map<string, PipelineFlowLink>()

  for (const event of events) {
    if (!isApplicationStatus(event.toStatus)) continue
    const from = event.fromStatus === null ? "saved" : event.fromStatus
    if (!isApplicationStatus(from)) continue
    if (from === event.toStatus) continue

    const key = `${from}->${event.toStatus}`
    const existing = counts.get(key)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(key, { from, to: event.toStatus, count: 1 })
    }
  }

  const links = Array.from(counts.values())
  const maxLinkCount = links.reduce((max, link) => Math.max(max, link.count), 0)

  return { links, maxLinkCount }
}
