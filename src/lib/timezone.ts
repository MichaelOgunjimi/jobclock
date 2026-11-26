/** Shown when a user has no stored timezone yet (or a stored one is no longer valid). JobClock is UK-first. */
export const DEFAULT_TIMEZONE = "Europe/London"

/**
 * True for an IANA zone name this runtime knows ("Europe/London", "America/New_York", "UTC").
 * Checked by constructing a formatter rather than against Intl.supportedValuesOf, which omits "UTC" and legacy
 * aliases a browser may still report (e.g. "Asia/Calcutta"). The pattern keeps offsets like "+01:00" out.
 */
export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64) return false
  if (value !== "UTC" && !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) return false
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** The user's zone, or Europe/London when it is missing or invalid. */
export const resolveTimezone = (value: string | null | undefined): string => (isValidTimezone(value) ? value : DEFAULT_TIMEZONE)

/** Calendar date in the user's zone as YYYY-MM-DD. */
export function formatLocalDate(iso: string | Date, timezone?: string | null): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: resolveTimezone(timezone), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso))
}

// "BST", "CET" in en-GB; "EST", "PST" in en-US. Each locale falls back to "GMT+1" for the other's zones, so take the first real name.
function zoneAbbreviation(date: Date, timeZone: string): string {
  const names = ["en-GB", "en-US"].map((locale) => new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" }).formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? "")
  return names.find((name) => name && !/^GMT[+-]/.test(name)) ?? names[0]
}

/** "2026-06-21 14:30 BST": date, 24-hour time and zone abbreviation, in the user's zone. */
export function formatLocalDateTime(iso: string | Date, timezone?: string | null): string {
  const timeZone = resolveTimezone(timezone)
  const date = new Date(iso)
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)
  return `${formatLocalDate(date, timeZone)} ${time} ${zoneAbbreviation(date, timeZone)}`
}

const HOUR_MS = 3_600_000

/** Adds whole days to a YYYY-MM-DD calendar date. */
export function addDaysToDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

// How far the zone's wall clock is ahead of UTC at this instant, in ms.
function offsetMs(instant: Date, timeZone: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23" })
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  )
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(instant.getTime() / 1000) * 1000
}

/** The first instant of a calendar date (YYYY-MM-DD) in the user's zone. DST days are 23 or 25 hours long, so never add 24h to this. */
export function startOfLocalDay(date: string, timezone?: string | null): Date {
  const timeZone = resolveTimezone(timezone)
  const [year, month, day] = date.split("-").map(Number)
  const wall = Date.UTC(year, month - 1, day)
  let t = wall - offsetMs(new Date(wall), timeZone)
  t = wall - offsetMs(new Date(t), timeZone)
  // A zone whose clock skips midnight (Havana) lands an hour early; one that repeats it lands an hour late.
  while (formatLocalDate(new Date(t), timeZone) < date) t += HOUR_MS
  while (formatLocalDate(new Date(t - 1), timeZone) >= date) t -= HOUR_MS
  return new Date(t)
}
