import { SCOPE_READ, SCOPE_WRITE } from "@/lib/oauth/config"

/** What the owner can choose for a connection: how much it may do and how long it lasts. Pure, so Settings, the consent page and the server share it. */

export type TokenAccess = "read" | "write"
export const TOKEN_ACCESS_SCOPES: Record<TokenAccess, string[]> = {
  read: [SCOPE_READ],
  write: [SCOPE_READ, SCOPE_WRITE],
}
export const DEFAULT_TOKEN_ACCESS: TokenAccess = "read"

export function parseTokenAccess(value: unknown): TokenAccess | null {
  return value === "read" || value === "write" ? value : null
}

export const canWrite = (scopes: readonly string[]) => scopes.includes(SCOPE_WRITE)
export const scopeLabel = (scopes: readonly string[]) => (canWrite(scopes) ? "Read and change" : "Read only")

export interface DurationOption {
  value: string
  label: string
  /** null = does not expire. */
  days: number | null
}

export const TOKEN_EXPIRY_OPTIONS: readonly DurationOption[] = [
  { value: "7", label: "7 days", days: 7 },
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
  { value: "365", label: "1 year", days: 365 },
  { value: "never", label: "Never expires", days: null },
]
export const DEFAULT_TOKEN_EXPIRY = "90"

export const CONNECTION_DURATION_OPTIONS: readonly DurationOption[] = [
  { value: "30", label: "30 days", days: 30 },
  { value: "90", label: "90 days", days: 90 },
  { value: "365", label: "1 year", days: 365 },
  { value: "forever", label: "Until I revoke it", days: null },
]
export const DEFAULT_CONNECTION_DURATION = "30"

const DAY_MS = 24 * 60 * 60 * 1000

/** Turns a submitted choice into an expiry date (null = never). Anything that is not one of the offered values is rejected, never guessed. */
export function resolveExpiry(options: readonly DurationOption[], value: unknown, now = new Date()): { ok: true; expiresAt: Date | null } | { ok: false } {
  const option = typeof value === "string" ? options.find((candidate) => candidate.value === value) : undefined
  if (!option) return { ok: false }
  return { ok: true, expiresAt: option.days === null ? null : new Date(now.getTime() + option.days * DAY_MS) }
}

const formatDay = (date: Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(date)

/** "Expires 12 Feb 2027 (in 83 days)", "Expired 3 Nov 2026" or "Never expires". */
export function describeExpiry(expiresAt: string | null, now = new Date(), never = "Never expires"): { text: string; expired: boolean; daysLeft: number | null } {
  if (!expiresAt) return { text: never, expired: false, daysLeft: null }
  const at = new Date(expiresAt)
  const msLeft = at.getTime() - now.getTime()
  if (msLeft <= 0) return { text: `Expired ${formatDay(at)}`, expired: true, daysLeft: 0 }
  const daysLeft = Math.ceil(msLeft / DAY_MS)
  return { text: `Expires ${formatDay(at)} (${daysLeft === 1 ? "in 1 day" : `in ${daysLeft} days`})`, expired: false, daysLeft }
}
