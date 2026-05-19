/**
 * Elapsed duration as `m:ss` (e.g. 14s → "0:14", 75s → "1:15"). Clamps
 * negative/NaN input to "0:00". Used for the generation progress timer.
 */
export function formatElapsed(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

/**
 * Compact relative-time label for notification rows: "just now", "5m ago",
 * "3h ago", "2d ago", then an absolute date once older than a week.
 */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const diff = now - then
  if (diff < 60_000) return "just now"
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(then).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}
