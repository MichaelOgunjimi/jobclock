import { z } from "zod"

/** Statuses where an interview date is meaningful; matches the statuses the reminder email query accepts. */
export const INTERVIEW_DATE_STATUSES = ["applied", "screening", "interview"] as const

/** Client sends an absolute instant (`Date#toISOString`); the DB stores it as UTC timestamptz. */
export const interviewAtSchema = z
  .string()
  .datetime({ offset: true, message: "Enter a valid date and time" })
  .refine((value) => {
    const year = new Date(value).getUTCFullYear()
    return year >= 2000 && year <= 2100
  }, "Enter a date between 2000 and 2100")

/** UTC ISO instant -> value for `<input type="datetime-local">` in the runtime's local timezone. */
export function toLocalInputValue(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** `datetime-local` value (wall-clock in the runtime's local timezone) -> UTC ISO instant, or null when empty/invalid. */
export function fromLocalInputValue(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
