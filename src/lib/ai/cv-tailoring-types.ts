import type { CvData } from "@/lib/supabase/database.types"

// ── Stage B: JD Analysis ──────────────────────────────────────────────────────

export interface JobAnalysis {
  title: string
  company?: string
  location?: string | null
  seniority?: string
  job_family: string
  must_have_keywords: string[]
  nice_to_have_keywords: string[]
  responsibilities: string[]
  qualifications: string[]
  tools_and_technologies: string[]
  soft_skills: string[]
  domain_terms: string[]
  summary: string
}

// ── Stage C: CV-to-JD Match ───────────────────────────────────────────────────

export interface RankedEvidence {
  /** Composite key: "Title at Company" / "ProjectName" / "Degree at Institution" */
  id: string
  type: string
  title: string
  relevance_score: number
  matched_requirements: string[]
  reasoning: string
}

export interface CvMatchAnalysis {
  matched_keywords: string[]
  missing_keywords: string[]
  weak_keywords: string[]
  evidence_ranking: {
    experience: RankedEvidence[]
    projects: RankedEvidence[]
    education: RankedEvidence[]
    activities: RankedEvidence[]
  }
  top_strengths: string[]
  tailoring_strategy: {
    summary_focus: string[]
    prioritize_experience_ids: string[]
    prioritize_project_ids: string[]
    prioritize_education_ids: string[]
    emphasize_skills: string[]
    deprioritize_items: string[]
  }
}

// ── Stage D: Tailoring Plan ───────────────────────────────────────────────────

export interface TailoringInstruction {
  /** Same composite key format as RankedEvidence.id */
  id: string
  action: string
  reasons: string[]
  target_keywords: string[]
  target_themes: string[]
}

export interface CvTailoringPlan {
  target_title: string
  target_company?: string
  target_seniority?: string
  target_job_family: string
  summary_strategy: {
    should_rewrite: boolean
    focus_keywords: string[]
    focus_themes: string[]
  }
  experience_plan: TailoringInstruction[]
  project_plan: TailoringInstruction[]
  education_plan: TailoringInstruction[]
  skills_plan: {
    prioritize: string[]
    add_if_present_in_cv: string[]
    remove_or_deprioritize: string[]
    ordering_strategy: string
  }
  formatting_notes: string[]
}

// ── Stage E: Tailored CV Result ───────────────────────────────────────────────

export interface AtsMatchEstimate {
  score: number
  basis: string
}

export interface TailoredCvResult {
  cv: CvData
  matched_keywords: string[]
  missing_keywords: string[]
  match_summary: string
  ats_match_estimate?: AtsMatchEstimate
}

// ── Stored shape in customized_cvs.skills_gap ─────────────────────────────────

export interface StoredSkillsGap {
  /** Backward-compat key consumed by parseSkillsGap() */
  gap: string[]
  /** Backward-compat key consumed by parseSkillsGap() */
  changes: string
  matched_keywords: string[]
  missing_keywords: string[]
  match_summary: string
  ats_basis?: string
}

// ── SSE progress events (client ↔ generate route) ────────────────────────────

export type GenerationStageId = "B" | "C" | "D" | "E"
export type GenerationStageStatus = "running" | "done" | "error"

export type GenerationProgressEvent =
  | { stage: GenerationStageId; status: GenerationStageStatus; error?: string }
  | { done: true }
