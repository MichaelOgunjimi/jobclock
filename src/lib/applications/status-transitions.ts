import type { ApplicationStatus } from "@/lib/supabase/database.types"

export const ACTIVE_APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
]

export const APPLICATION_OUTCOME_STATUSES: readonly ApplicationStatus[] = [
  "rejected",
  "withdrawn",
  "ghosted",
]

export const APPLICATION_STATUSES = [
  ...ACTIVE_APPLICATION_STATUSES,
  ...APPLICATION_OUTCOME_STATUSES,
] as const

export type ApplicationStatusIntent = "progress" | "correction" | "reopen"

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return APPLICATION_STATUSES.includes(value as ApplicationStatus)
}

export function getApplicationStatusTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
  intent: ApplicationStatusIntent = "progress"
): ApplicationStatus[] | null {
  if (from === to) return []

  const fromIndex = ACTIVE_APPLICATION_STATUSES.indexOf(from)
  const toIndex = ACTIVE_APPLICATION_STATUSES.indexOf(to)
  const fromIsOutcome = APPLICATION_OUTCOME_STATUSES.includes(from)
  const toIsOutcome = APPLICATION_OUTCOME_STATUSES.includes(to)

  if (intent === "progress") {
    if (fromIndex >= 0 && toIndex > fromIndex) {
      return ACTIVE_APPLICATION_STATUSES.slice(fromIndex + 1, toIndex + 1)
    }
    if (fromIndex >= 0 && toIsOutcome) {
      return from === "saved" ? ["applied", to] : [to]
    }
  }

  if (intent === "correction") {
    if (fromIndex > 0 && toIndex >= 0 && toIndex < fromIndex) return [to]
    if (fromIsOutcome && toIsOutcome) return [to]
  }

  if (intent === "reopen" && fromIsOutcome && toIndex >= 0) return [to]

  return null
}

export function getNormalStatusChoices(current: ApplicationStatus): ApplicationStatus[] {
  const currentIndex = ACTIVE_APPLICATION_STATUSES.indexOf(current)
  if (currentIndex < 0) return [current]
  return [...ACTIVE_APPLICATION_STATUSES.slice(currentIndex), ...APPLICATION_OUTCOME_STATUSES]
}

export function getCorrectionStatusChoices(current: ApplicationStatus): ApplicationStatus[] {
  const currentIndex = ACTIVE_APPLICATION_STATUSES.indexOf(current)
  if (currentIndex > 0) return ACTIVE_APPLICATION_STATUSES.slice(0, currentIndex)
  if (APPLICATION_OUTCOME_STATUSES.includes(current)) {
    return APPLICATION_OUTCOME_STATUSES.filter((status) => status !== current)
  }
  return []
}

export function getReopenStatusChoices(current: ApplicationStatus): ApplicationStatus[] {
  return APPLICATION_OUTCOME_STATUSES.includes(current)
    ? [...ACTIVE_APPLICATION_STATUSES]
    : []
}
