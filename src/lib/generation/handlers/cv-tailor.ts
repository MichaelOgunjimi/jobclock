import { db } from "@/lib/db"
import { customizedCvs } from "@/lib/db/schema"
import { resolveAiConfig, generateText } from "@/lib/ai"
import { extractJson } from "@/lib/ai/extract-json"
import { normalizeObjectStrings } from "@/lib/cv/normalize"
import {
  STAGE_B_SYSTEM_PROMPT,
  buildStageBUserPrompt,
  STAGE_C_SYSTEM_PROMPT,
  buildStageCUserPrompt,
  STAGE_D_SYSTEM_PROMPT,
  buildStageDUserPrompt,
  STAGE_E_SYSTEM_PROMPT,
  buildStageEUserPrompt,
} from "@/lib/ai/prompts"
import {
  jobAnalysisSchema,
  cvMatchAnalysisSchema,
  cvTailoringPlanSchema,
  tailoredCvResultSchema,
} from "@/lib/ai/cv-tailoring-schemas"
import type { JobAnalysis, CvMatchAnalysis, CvTailoringPlan, StoredSkillsGap } from "@/lib/ai/cv-tailoring-types"
import type { Json } from "@/lib/supabase/database.types"
import type { GenerationJob } from "../jobs"
import { loadCvTailorContext } from "./cv-tailor-context"

function parseStage<T>(raw: string, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } } }, stageName: string): T {
  const extracted = extractJson(raw)
  const result = schema.safeParse(extracted)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    throw new Error(`${stageName} validation failed: ${issues}`)
  }
  return result.data
}

/**
 * cv_tailor generation handler. Runs the 4-stage B→C→D→E pipeline, inserts
 * into customized_cvs, and returns the row id as the result_ref.
 */
export async function cvTailorHandler(job: GenerationJob): Promise<string> {
  const ctx = await loadCvTailorContext(job)
  const { settings, apiKey } = resolveAiConfig(ctx.preferences)

  const { title, company, location, description, cvJson } = ctx

  const jobAnalysis: JobAnalysis = parseStage(
    await generateText(settings, apiKey, STAGE_B_SYSTEM_PROMPT, buildStageBUserPrompt({ title, company, location, description })),
    jobAnalysisSchema,
    "Stage B",
  )

  const matchAnalysis: CvMatchAnalysis = parseStage(
    await generateText(settings, apiKey, STAGE_C_SYSTEM_PROMPT, buildStageCUserPrompt({ jobAnalysis, cvJson })),
    cvMatchAnalysisSchema,
    "Stage C",
  )

  const tailoringPlan: CvTailoringPlan = parseStage(
    await generateText(settings, apiKey, STAGE_D_SYSTEM_PROMPT, buildStageDUserPrompt({ jobAnalysis, matchAnalysis, cvJson })),
    cvTailoringPlanSchema,
    "Stage D",
  )

  const result = parseStage(
    await generateText(settings, apiKey, STAGE_E_SYSTEM_PROMPT, buildStageEUserPrompt({ jobAnalysis, cvJson, tailoringPlan, title, company, location }), 16384),
    tailoredCvResultSchema,
    "Stage E",
  )

  if (!result.cv) throw new Error("AI returned incomplete CV data. Please try again.")

  const skillsGap: StoredSkillsGap = {
    gap: result.missing_keywords,
    changes: result.match_summary,
    matched_keywords: result.matched_keywords,
    missing_keywords: result.missing_keywords,
    match_summary: result.match_summary,
    ats_basis: result.ats_match_estimate?.basis,
  }

  const [inserted] = await db
    .insert(customizedCvs)
    .values({
      userId: ctx.userId,
      applicationId: ctx.applicationId,
      cvJson: normalizeObjectStrings(result.cv) as unknown as Json,
      atsScore: result.ats_match_estimate?.score ?? null,
      skillsGap: skillsGap as unknown as Json,
    })
    .returning({ id: customizedCvs.id })

  return inserted.id
}
