import { z } from "zod/v4"

export const reviewFindingCategory = z.enum([
  "weak_verb",
  "missing_metric",
  "bullet_too_short",
  "bullet_too_long",
  "generic_filler",
  "summary_issue",
  "missing_date",
  "skills_section",
  "ats_hazard",
])

export const reviewFindingSeverity = z.enum(["low", "medium", "high"])

export const reviewFindingLocationSection = z.enum([
  "summary",
  "experience",
  "projects",
  "education",
  "skills",
])

export const reviewFindingSchema = z.object({
  category: reviewFindingCategory,
  severity: reviewFindingSeverity,
  location: z.object({
    section: reviewFindingLocationSection,
    entryId: z.string().optional(),
    bulletIndex: z.number().int().nonnegative().optional(),
  }),
  message: z.string(),
  suggestion: z.string(),
})

export const reviewFindingsResponseSchema = z.object({
  findings: z.array(reviewFindingSchema).default([]),
})

export type CvReviewFinding = z.infer<typeof reviewFindingSchema>
export type CvReviewFindingCategory = z.infer<typeof reviewFindingCategory>

/**
 * Tolerantly parse a persisted `user_cvs.review_findings` value. The column is
 * untyped jsonb written by the review handler, so accept null, a bare array,
 * or a `{ findings: [...] }` wrapper, and silently drop entries that no longer
 * match the current finding schema.
 */
export function parseReviewFindings(raw: unknown): CvReviewFinding[] {
  if (raw == null) return []
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "object" && Array.isArray((raw as { findings?: unknown }).findings)
      ? (raw as { findings: unknown[] }).findings
      : []
  const out: CvReviewFinding[] = []
  for (const entry of list) {
    const parsed = reviewFindingSchema.safeParse(entry)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}
export type CvReviewFindingSeverity = z.infer<typeof reviewFindingSeverity>
