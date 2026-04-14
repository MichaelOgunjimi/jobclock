import { z } from "zod/v4"

/** Coerce any value to string (handles numbers, booleans AI might return) */
const coerceStr = z.coerce.string()
const optCoerceStr = z.coerce.string().optional()

/** Coerce any value to number (handles "85" strings AI might return) */
const coerceNum = z.coerce.number()

/** Coerce a value to string array — handles single string or mixed arrays */
const strArray = z
  .any()
  .transform((v) => {
    if (Array.isArray(v)) return v.map(String)
    if (v == null) return []
    return [String(v)]
  })
  .default([])

const rankedEvidenceSchema = z
  .object({
    id: coerceStr.default(""),
    type: coerceStr.default("experience"),
    title: coerceStr.default(""),
    relevance_score: coerceNum.default(0),
    matched_requirements: strArray,
    reasoning: coerceStr.default(""),
  })
  .passthrough()

const tailoringInstructionSchema = z
  .object({
    id: coerceStr.default(""),
    action: coerceStr.default("keep"),
    reasons: strArray,
    target_keywords: strArray,
    target_themes: strArray,
  })
  .passthrough()

const cvExperienceSchema = z
  .object({
    company: coerceStr.default(""),
    title: coerceStr.default(""),
    start_date: optCoerceStr,
    end_date: optCoerceStr,
    description: coerceStr.default(""),
    highlights: strArray,
    location: optCoerceStr,
  })
  .passthrough()

const cvEducationSchema = z
  .object({
    institution: coerceStr.default(""),
    degree: coerceStr.default(""),
    field: optCoerceStr,
    start_date: optCoerceStr,
    end_date: optCoerceStr,
    grade: optCoerceStr,
    location: optCoerceStr,
    gpa: z.any().optional().transform((v) => v != null ? String(v) : undefined),
    honors: optCoerceStr,
    relevant_modules: strArray,
  })
  .passthrough()

const cvProjectSchema = z
  .object({
    name: coerceStr.default(""),
    description: coerceStr.default(""),
    highlights: strArray,
    technologies: strArray,
    url: optCoerceStr,
    start_date: optCoerceStr,
    end_date: optCoerceStr,
  })
  .passthrough()

const cvDataSchema = z
  .object({
    name: optCoerceStr,
    email: optCoerceStr,
    phone: optCoerceStr,
    location: optCoerceStr,
    linkedin: optCoerceStr,
    website: optCoerceStr,
    summary: optCoerceStr,
    experience: z.array(cvExperienceSchema).default([]),
    education: z.array(cvEducationSchema).default([]),
    projects: z.array(cvProjectSchema).default([]),
    skills: strArray,
    languages: strArray,
    certifications: strArray,
    activities: z.array(cvExperienceSchema).default([]),
  })
  .passthrough()

export const jobAnalysisSchema = z
  .object({
    title: coerceStr.default("Unknown"),
    company: optCoerceStr,
    location: z.coerce.string().nullable().optional(),
    seniority: coerceStr.default("unknown"),
    job_family: coerceStr.default("general"),
    must_have_keywords: strArray,
    nice_to_have_keywords: strArray,
    responsibilities: strArray,
    qualifications: strArray,
    tools_and_technologies: strArray,
    soft_skills: strArray,
    domain_terms: strArray,
    summary: coerceStr.default(""),
  })
  .passthrough()

export const cvMatchAnalysisSchema = z
  .object({
    matched_keywords: strArray,
    missing_keywords: strArray,
    weak_keywords: strArray,
    evidence_ranking: z
      .object({
        experience: z.array(rankedEvidenceSchema).default([]),
        projects: z.array(rankedEvidenceSchema).default([]),
        education: z.array(rankedEvidenceSchema).default([]),
        activities: z.array(rankedEvidenceSchema).default([]),
      })
      .default({ experience: [], projects: [], education: [], activities: [] }),
    top_strengths: strArray,
    tailoring_strategy: z
      .object({
        summary_focus: strArray,
        prioritize_experience_ids: strArray,
        prioritize_project_ids: strArray,
        prioritize_education_ids: strArray,
        emphasize_skills: strArray,
        deprioritize_items: strArray,
      })
      .default({
        summary_focus: [],
        prioritize_experience_ids: [],
        prioritize_project_ids: [],
        prioritize_education_ids: [],
        emphasize_skills: [],
        deprioritize_items: [],
      }),
  })
  .passthrough()

export const cvTailoringPlanSchema = z
  .object({
    target_title: coerceStr.default(""),
    target_company: optCoerceStr,
    target_seniority: optCoerceStr,
    target_job_family: coerceStr.default("general"),
    summary_strategy: z
      .object({
        should_rewrite: z.boolean().default(false),
        focus_keywords: strArray,
        focus_themes: strArray,
      })
      .default({
        should_rewrite: false,
        focus_keywords: [],
        focus_themes: [],
      }),
    experience_plan: z.array(tailoringInstructionSchema).default([]),
    project_plan: z.array(tailoringInstructionSchema).default([]),
    education_plan: z.array(tailoringInstructionSchema).default([]),
    skills_plan: z
      .object({
        prioritize: strArray,
        add_if_present_in_cv: strArray,
        remove_or_deprioritize: strArray,
        ordering_strategy: coerceStr.default(""),
      })
      .default({
        prioritize: [],
        add_if_present_in_cv: [],
        remove_or_deprioritize: [],
        ordering_strategy: "",
      }),
    formatting_notes: strArray,
  })
  .passthrough()

export const tailoredCvResultSchema = z
  .object({
    cv: cvDataSchema.optional(),
    tailored_cv: cvDataSchema.optional(),
    matched_keywords: strArray,
    missing_keywords: strArray,
    match_summary: coerceStr.default(""),
    ats_match_estimate: z
      .object({
        score: coerceNum.default(0),
        basis: coerceStr.default(""),
      })
      .optional(),
  })
  .passthrough()
  .transform((data) => ({
    ...data,
    // AI sometimes uses "tailored_cv" instead of "cv"
    cv: data.cv ?? data.tailored_cv,
  }))
