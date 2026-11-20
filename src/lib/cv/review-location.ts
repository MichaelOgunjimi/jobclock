import type { CvData } from "@/lib/supabase/database.types"
import type { CvReviewFinding } from "@/lib/ai/cv-review-schemas"

type Location = CvReviewFinding["location"]

/** Pure helpers shared by the review route (server) and the editor (client). */

const norm = (value: string | undefined) => (value ?? "").trim().toLowerCase()

// The review prompt asks for "Title at Company" / project name; accept the bare title or name too.
function findEntryIndex(cv: CvData, location: Location): number {
  const id = norm(location.entryId)
  const entries =
    location.section === "experience"
      ? (cv.experience ?? []).map((e) => [`${e.title} at ${e.company}`, e.title])
      : location.section === "projects"
        ? (cv.projects ?? []).map((p) => [p.name])
        : []
  if (!id) return entries.length === 1 ? 0 : -1
  return entries.findIndex((names) => names.some((name) => norm(name) === id))
}

/** The bullet or summary text a finding points at, or undefined when it cannot be located. */
export function getFindingText(cv: CvData, location: Location): string | undefined {
  if (location.section === "summary") return cv.summary
  if (location.bulletIndex == null) return undefined
  const index = findEntryIndex(cv, location)
  if (index < 0) return undefined
  const entry = location.section === "experience" ? cv.experience?.[index] : cv.projects?.[index]
  return entry?.highlights?.[location.bulletIndex]
}

/** A copy of `cv` with the text at `location` replaced, or null when the location no longer exists. */
export function setFindingText<T extends CvData>(cv: T, location: Location, text: string): T | null {
  if (location.section === "summary") return { ...cv, summary: text }
  if (getFindingText(cv, location) === undefined) return null
  const index = findEntryIndex(cv, location)
  const key = location.section === "experience" ? "experience" : "projects"
  const entries = [...(cv[key] ?? [])] as Array<{ highlights?: string[] }>
  const highlights = [...(entries[index].highlights ?? [])]
  highlights[location.bulletIndex!] = text
  entries[index] = { ...entries[index], highlights }
  return { ...cv, [key]: entries }
}

const NUMBER = /\d[\d,.]*/g

/**
 * A rewrite may rephrase but never add figures. Reject any number that is not already in the text it replaces
 * (for the summary, anywhere in the CV, since a summary legitimately restates facts from other sections).
 */
export function rewriteIsGrounded(original: string, rewrite: string, knownText = original): boolean {
  const trimmed = rewrite.trim()
  if (!trimmed || trimmed === original.trim()) return false
  const known = new Set(knownText.match(NUMBER) ?? [])
  return (trimmed.match(NUMBER) ?? []).every((n) => known.has(n))
}

/**
 * Attach the current text (`original`) to each locatable finding and drop any `rewrite` that is empty,
 * unchanged, or introduces numbers the CV does not contain.
 */
export function groundFindings(cv: CvData, findings: CvReviewFinding[]): CvReviewFinding[] {
  return mergeDuplicateFindings(findings.map(({ rewrite, ...finding }) => {
    delete finding.original // never trust a model-supplied original
    const original = getFindingText(cv, finding.location)
    if (original === undefined) return finding
    const known = finding.location.section === "summary" ? JSON.stringify(cv) : original
    const grounded = rewrite !== undefined && rewriteIsGrounded(original, rewrite, known)
    return { ...finding, original, ...(grounded ? { rewrite: rewrite!.trim() } : {}) }
  }))
}

const SEVERITY_RANK = { low: 0, medium: 1, high: 2 } as const

/**
 * One card per category and location: the model sometimes reports the same problem twice for one bullet.
 * Keeps the first finding, joins any different message or suggestion, and takes the highest severity.
 * Idempotent, so it is safe to run again on findings that were stored before merging existed.
 */
export function mergeDuplicateFindings(findings: CvReviewFinding[]): CvReviewFinding[] {
  const merged = new Map<string, CvReviewFinding>()
  for (const finding of findings) {
    const { section, entryId, bulletIndex } = finding.location
    const key = [finding.category, section, norm(entryId), bulletIndex ?? ""].join("|")
    const first = merged.get(key)
    if (!first) {
      merged.set(key, finding)
      continue
    }
    // Keep the more specific text when one contains the other, otherwise join both.
    const join = (a: string, b: string) =>
      norm(a).includes(norm(b)) ? a : norm(b).includes(norm(a)) ? b : `${a} ${b}`
    merged.set(key, {
      ...first,
      severity: SEVERITY_RANK[finding.severity] > SEVERITY_RANK[first.severity] ? finding.severity : first.severity,
      message: join(first.message, finding.message),
      suggestion: join(first.suggestion, finding.suggestion),
      ...(first.rewrite === undefined && finding.rewrite !== undefined ? { rewrite: finding.rewrite } : {}),
    })
  }
  return [...merged.values()]
}

/** Identity of a finding across re-reviews, used to keep dismissals and to diff old against new. */
export function findingKey(finding: CvReviewFinding): string {
  const { section, entryId, bulletIndex } = finding.location
  return [finding.category, section, entryId ?? "", bulletIndex ?? "", finding.original ?? ""].join("|")
}
