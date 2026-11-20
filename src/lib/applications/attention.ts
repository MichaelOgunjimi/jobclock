/** What "needs attention" means. The reminder emails and the MCP tools both read these, so they cannot drift apart. */

/** Applied or screening applications with no status change for this many days are stale. */
export const STALE_AFTER_DAYS = 21
export const STALE_STATUSES = ["applied", "screening"] as const

/** A saved job is flagged when its apply deadline is after today and at most this many days away. */
export const DEADLINE_WINDOW_DAYS = 2
