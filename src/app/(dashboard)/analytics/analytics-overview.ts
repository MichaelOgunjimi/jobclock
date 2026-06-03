import type { ApplicationStatus } from "@/lib/supabase/database.types"
import { APPLICATION_STATUS_OPTIONS, isApplicationStatus } from "../applications/pipeline-metrics"

interface AnalyticsOverviewInput {
  total: number
  active: number
  sent: number
  closed: number
  interviews: number
  offers: number
}

export interface AnalyticsOverviewCard {
  label: string
  value: number
  note?: string
}

export interface AnalyticsStatusFocusLink {
  value: ApplicationStatus | "all"
  label: string
  href: string
  active: boolean
  accent?: string
}

export type AnalyticsEmptyState = "no-applications" | "no-transitions" | null

export function buildAnalyticsOverviewCards({
  total,
  active,
  sent,
  closed,
  interviews,
  offers,
}: AnalyticsOverviewInput): AnalyticsOverviewCard[] {
  return [
    {
      label: "Total applications",
      value: total,
      note: "Every tracked role in the pipeline.",
    },
    {
      label: "Active",
      value: active,
      note: `${formatShare(active, total)} still open.`,
    },
    {
      label: "In motion",
      value: sent,
      note: "Applied, screening, interview, or offer.",
    },
    {
      label: "Closed",
      value: closed,
      note: `${formatShare(closed, total)} with an outcome.`,
    },
    {
      label: "Interviews",
      value: interviews,
      note: total > 0 ? `${Math.round((interviews / total) * 100)}% rate.` : undefined,
    },
    {
      label: "Offers",
      value: offers,
      note: interviews > 0 ? `${Math.round((offers / interviews) * 100)}% from interview.` : "0% from interview.",
    },
  ]
}

export function buildAnalyticsStatusFocusLinks(focusedStatus: string | null | undefined): AnalyticsStatusFocusLink[] {
  const activeStatus = isApplicationStatus(focusedStatus ?? null) ? focusedStatus : null

  return [
    {
      value: "all",
      label: "All",
      href: "/analytics",
      active: activeStatus === null,
    },
    ...APPLICATION_STATUS_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      href: `/analytics?status=${option.value}`,
      active: activeStatus === option.value,
      accent: option.sankeyColor,
    })),
  ]
}

export function getAnalyticsEmptyState({
  totalApplications,
  transitionCount,
}: {
  totalApplications: number
  transitionCount: number
}): AnalyticsEmptyState {
  if (totalApplications === 0) return "no-applications"
  if (transitionCount === 0) return "no-transitions"
  return null
}

function formatShare(value: number, total: number) {
  if (total <= 0) return "0%"
  return `${Math.round((value / total) * 100)}%`
}
