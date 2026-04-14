import { z } from "zod/v4"

const rankedEvidenceSchema = z
  .object({
    id: z.string().default(""),
    type: z.string().default("experience"),
    title: z.string().default(""),
    relevance_score: z.number().default(0),
    matched_requirements: z.array(z.string()).default([]),
    reasoning: z.string().default(""),
  })
  .passthrough()

const tailoringInstructionSchema = z
  .object({
    id: z.string().default(""),
    action: z.string().default("keep"),
    reasons: z.array(z.string()).default([]),
    target_keywords: z.array(z.string()).default([]),
    target_themes: z.array(z.string()).default([]),
  })
  .passthrough()

const cvExperienceSchema = z
  .object({
    company: z.string().default(""),
    title: z.string().default(""),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    description: z.string().default(""),
    highlights: z.array(z.string()).default([]),
    location: z.string().optional(),
  })
  .passthrough()

const cvEducationSchema = z
  .object({
    institution: z.string().default(""),
    degree: z.string().default(""),
    field: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    grade: z.string().optional(),
    location: z.string().optional(),
    gpa: z.union([z.string(), z.number()]).optional().transform((v) => v != null ? String(v) : undefined),
    honors: z.string().optional(),
    relevant_modules: z.array(z.string()).default([]),
  })
  .passthrough()

const cvProjectSchema = z
  .object({
    name: z.string().default(""),
    description: z.string().default(""),
    highlights: z.array(z.string()).default([]),
    technologies: z.array(z.string()).default([]),
    url: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .passthrough()

const cvDataSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    linkedin: z.string().optional(),
    website: z.string().optional(),
    summary: z.string().optional(),
    experience: z.array(cvExperienceSchema).default([]),
    education: z.array(cvEducationSchema).default([]),
    projects: z.array(cvProjectSchema).default([]),
    skills: z.array(z.string()).default([]),
    languages: z.array(z.string()).default([]),
    certifications: z.array(z.string()).default([]),
    activities: z.array(cvExperienceSchema).default([]),
  })
  .passthrough()

export const jobAnalysisSchema = z
  .object({
    title: z.string().default("Unknown"),
    company: z.string().optional(),
    location: z.string().nullable().optional(),
    seniority: z.string().default("unknown"),
    job_family: z.string().default("general"),
    must_have_keywords: z.array(z.string()).default([]),
    nice_to_have_keywords: z.array(z.string()).default([]),
    responsibilities: z.array(z.string()).default([]),
    qualifications: z.array(z.string()).default([]),
    tools_and_technologies: z.array(z.string()).default([]),
    soft_skills: z.array(z.string()).default([]),
    domain_terms: z.array(z.string()).default([]),
    summary: z.string().default(""),
  })
  .passthrough()

export const cvMatchAnalysisSchema = z
  .object({
    matched_keywords: z.array(z.string()).default([]),
    missing_keywords: z.array(z.string()).default([]),
    weak_keywords: z.array(z.string()).default([]),
    evidence_ranking: z
      .object({
        experience: z.array(rankedEvidenceSchema).default([]),
        projects: z.array(rankedEvidenceSchema).default([]),
        education: z.array(rankedEvidenceSchema).default([]),
        activities: z.array(rankedEvidenceSchema).default([]),
      })
      .default({ experience: [], projects: [], education: [], activities: [] }),
    top_strengths: z.array(z.string()).default([]),
    tailoring_strategy: z
      .object({
        summary_focus: z.array(z.string()).default([]),
        prioritize_experience_ids: z.array(z.string()).default([]),
        prioritize_project_ids: z.array(z.string()).default([]),
        prioritize_education_ids: z.array(z.string()).default([]),
        emphasize_skills: z.array(z.string()).default([]),
        deprioritize_items: z.array(z.string()).default([]),
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
    target_title: z.string().default(""),
    target_company: z.string().optional(),
    target_seniority: z.string().optional(),
    target_job_family: z.string().default("general"),
    summary_strategy: z
      .object({
        should_rewrite: z.boolean().default(false),
        focus_keywords: z.array(z.string()).default([]),
        focus_themes: z.array(z.string()).default([]),
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
        prioritize: z.array(z.string()).default([]),
        add_if_present_in_cv: z.array(z.string()).default([]),
        remove_or_deprioritize: z.array(z.string()).default([]),
        ordering_strategy: z.string().default(""),
      })
      .default({
        prioritize: [],
        add_if_present_in_cv: [],
        remove_or_deprioritize: [],
        ordering_strategy: "",
      }),
    formatting_notes: z.array(z.string()).default([]),
  })
  .passthrough()

export const tailoredCvResultSchema = z
  .object({
    cv: cvDataSchema,
    matched_keywords: z.array(z.string()).default([]),
    missing_keywords: z.array(z.string()).default([]),
    match_summary: z.string().default(""),
    ats_match_estimate: z
      .object({
        score: z.number().default(0),
        basis: z.string().default(""),
      })
      .optional(),
  })
  .passthrough()
