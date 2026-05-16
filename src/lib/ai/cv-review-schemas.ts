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
export type CvReviewFindingSeverity = z.infer<typeof reviewFindingSeverity>
