/** Validation for the owner-editable tracking details: tags, source and applied date. Pure, so the UI and the helpers share one rule set. */

/** Twenty tags is plenty for one application; more makes the list unreadable and slows filtering. */
export const MAX_TAGS = 20
/** A tag is a short label, not a sentence; 30 characters keeps it on one line on a phone. */
export const MAX_TAG_LENGTH = 30
export const MAX_SOURCE_LENGTH = 60
export const MIN_APPLIED_YEAR = 2000

/** Where an application came from, suggested (not enforced) in the source field. */
export const SOURCE_SUGGESTIONS = ["LinkedIn", "Indeed", "Reed", "Adzuna", "Company website", "Referral", "Recruiter", "Other"] as const

export const TAGS_HINT = `Up to ${MAX_TAGS} tags, ${MAX_TAG_LENGTH} characters each. Short labels keep the list readable on a phone; duplicates are ignored whatever their capitalisation.`
export const SOURCE_HINT = `Where you found it, up to ${MAX_SOURCE_LENGTH} characters. Pick a suggestion or type your own.`
export const APPLIED_AT_HINT = "The day you applied. It can't be before 2000 or more than a day ahead, since you can only have applied already."

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string }

/** Trims, drops blanks, removes case-insensitive duplicates (the first spelling wins) and enforces the limits. */
export function normalizeTags(input: readonly string[]): Validated<string[]> {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const raw of input) {
    const tag = raw.trim()
    if (!tag || seen.has(tag.toLowerCase())) continue
    if (tag.length > MAX_TAG_LENGTH) return { ok: false, error: `Tags can be at most ${MAX_TAG_LENGTH} characters ("${tag.slice(0, 12)}…" is ${tag.length}).` }
    seen.add(tag.toLowerCase())
    tags.push(tag)
  }
  if (tags.length > MAX_TAGS) return { ok: false, error: `An application can have at most ${MAX_TAGS} tags.` }
  return { ok: true, value: tags }
}

/** Trims; an empty source clears it (null). */
export function normalizeSource(input: string | null): Validated<string | null> {
  const source = (input ?? "").trim()
  if (source.length > MAX_SOURCE_LENGTH) return { ok: false, error: `Source can be at most ${MAX_SOURCE_LENGTH} characters.` }
  return { ok: true, value: source || null }
}

const DAY_MS = 86_400_000

/**
 * `YYYY-MM-DD` (or null to clear) -> the instant stored in applied_at. A date has no time, so it is stored at noon UTC:
 * that shows as the same calendar day in every timezone from UTC-12 to UTC+12.
 */
export function normalizeAppliedAt(input: string | null, now = new Date()): Validated<Date | null> {
  if (input === null || input === "") return { ok: true, value: null }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input)
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)) : null
  if (!match || !date || date.toISOString().slice(0, 10) !== input) return { ok: false, error: "Enter a valid date." }
  if (date.getUTCFullYear() < MIN_APPLIED_YEAR) return { ok: false, error: `The applied date can't be before ${MIN_APPLIED_YEAR}.` }
  // One day of slack so a date that is already "today" somewhere in the world is accepted.
  if (date.getTime() - 12 * 3_600_000 > now.getTime() + DAY_MS) return { ok: false, error: "The applied date can't be in the future." }
  return { ok: true, value: date }
}
