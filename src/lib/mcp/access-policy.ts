import { SCOPE_INTERVIEW_READ, SCOPE_PROFILE_READ, SCOPE_PROFILE_WRITE, SCOPE_READ, SCOPE_WRITE } from "@/lib/oauth/config"

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

/**
 * The private-data scopes. Each is its own opt-in, off by default, never implied by an applications scope and never
 * added to an existing token or grant: to get one the owner creates a new token or connects the app again.
 */
export const EXTRA_SCOPES = [SCOPE_PROFILE_READ, SCOPE_INTERVIEW_READ, SCOPE_PROFILE_WRITE] as const
export type ExtraScope = (typeof EXTRA_SCOPES)[number]

export interface ExtraScopeOption {
  scope: ExtraScope
  /** Short name for badges and the Settings checkbox. */
  label: string
  /** Plain words for the consent page and Settings: what is shared. */
  description: string
  /** Completes "You gave it access to ..." in the security email. */
  email: string
}

export const EXTRA_SCOPE_OPTIONS: readonly ExtraScopeOption[] = [
  {
    scope: SCOPE_PROFILE_READ,
    label: "Profile and CVs",
    description: "Your name, phone, links and the full text of your CVs, plus your certificates list, tailored CVs and cover letters.",
    email: "read your profile, contact details and CVs",
  },
  {
    scope: SCOPE_INTERVIEW_READ,
    label: "Interview material",
    description: "Your interview stories and notes about yourself, saved interview prep and your saved practice answers.",
    email: "read your interview stories and notes about yourself",
  },
  {
    scope: SCOPE_PROFILE_WRITE,
    label: "Change profile and interview material",
    description: "Change your profile details, CV names and primary CV, interview stories and notes about yourself. It can never delete anything.",
    email: "change your profile and interview material",
  },
]

/** Every entry must be one of the offered scopes (unknown or repeated values are rejected, never ignored). Null when invalid. */
export function parseExtraScopes(value: unknown): ExtraScope[] | null {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > EXTRA_SCOPES.length) return null
  const wanted = new Set<unknown>(value)
  if (wanted.size !== value.length || value.some((item) => !EXTRA_SCOPES.includes(item as ExtraScope))) return null
  return EXTRA_SCOPES.filter((scope) => wanted.has(scope))
}

/** The scopes a new manual token is stored with. */
export const tokenScopes = (access: TokenAccess, extras: readonly ExtraScope[] = []): string[] => [
  ...TOKEN_ACCESS_SCOPES[access],
  ...EXTRA_SCOPES.filter((scope) => extras.includes(scope)),
]

/** The private-data options a connection holds, for badges and lists. */
export const extraScopeOptions = (scopes: readonly string[]) => EXTRA_SCOPE_OPTIONS.filter((option) => scopes.includes(option.scope))

/** "read and change", or "read only; also read your profile, contact details and CVs", for the security email. */
export function describeAccess(scopes: readonly string[]): string {
  const extras = extraScopeOptions(scopes).map((option) => option.email)
  return extras.length === 0 ? scopeLabel(scopes).toLowerCase() : `${scopeLabel(scopes).toLowerCase()} for applications; also ${extras.join("; ")}`
}

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
