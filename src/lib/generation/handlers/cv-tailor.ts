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
import type { ZodType } from "zod/v4"

function parseStage<T>(raw: string, schema: ZodType<T>, stageName: string): T {
  const extracted = extractJson(raw)
  const result = schema.safeParse(extracted)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    throw new Error(`${stageName} validation failed: ${issues}`)
  }
  return result.data
}

function skillKey(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-GB")
    .replace(/[‐‑‒–—-]/g, " ")
    .replace(/\s+/g, " ")
}

const GENERIC_SOFT_SKILLS = new Set([
  "adaptability",
  "analytical skills",
  "attention to detail",
  "attention to details",
  "collaboration",
  "communication",
  "communication skills",
  "creativity",
  "critical thinking",
  "decision making",
  "interpersonal skills",
  "leadership",
  "organisation",
  "organisational skills",
  "organization",
  "organizational skills",
  "ownership",
  "problem solving",
  "self motivation",
  "team work",
  "teamwork",
  "time management",
  "work ethic",
])

const MIN_TAILORED_SKILLS = 13
const MAX_TAILORED_SKILLS = 15

function isGenericSoftSkill(value: string): boolean {
  return GENERIC_SOFT_SKILLS.has(skillKey(value))
}

export function selectTailoredSkills(
  cvJson: string,
  tailoringPlan: CvTailoringPlan,
  generatedSkills: string[] | undefined,
): string[] {
  const originalSkills: string[] = []
  try {
    const originalCv = JSON.parse(cvJson) as {
      skills?: unknown
      projects?: Array<{ technologies?: unknown }>
    }
    const explicitSkills = [
      ...(Array.isArray(originalCv.skills) ? originalCv.skills : []),
      ...(Array.isArray(originalCv.projects)
        ? originalCv.projects.flatMap((project) =>
            Array.isArray(project?.technologies) ? project.technologies : []
          )
        : []),
    ]
    const seen = new Set<string>()
    for (const skill of explicitSkills) {
      if (typeof skill !== "string") continue
      const value = skill.trim()
      const key = skillKey(value)
      if (!value || isGenericSoftSkill(value) || seen.has(key)) continue
      originalSkills.push(value)
      seen.add(key)
    }
  } catch {
    return []
  }

  const originalByKey = new Map(originalSkills.map((skill) => [skillKey(skill), skill]))
  const planCandidates = [
    ...(tailoringPlan.skills_plan?.prioritize ?? []),
    ...(tailoringPlan.skills_plan?.keep ?? []),
  ]
  const proposedSkills = planCandidates.some((skill) => originalByKey.has(skillKey(skill)))
    ? planCandidates
    : (generatedSkills ?? [])

  const selected: string[] = []
  const selectedKeys = new Set<string>()
  for (const proposed of proposedSkills) {
    if (typeof proposed !== "string") continue
    const key = skillKey(proposed)
    const original = originalByKey.get(key)
    if (!original || selectedKeys.has(key)) continue
    selected.push(original)
    selectedKeys.add(key)
  }

  const requiredSkillCount = Math.min(MIN_TAILORED_SKILLS, originalSkills.length)
  if (selected.length < requiredSkillCount) {
    for (const original of originalSkills) {
      const key = skillKey(original)
      if (selectedKeys.has(key)) continue
      selected.push(original)
      selectedKeys.add(key)
      if (selected.length === requiredSkillCount) break
    }
  }

  return selected.slice(0, MAX_TAILORED_SKILLS)
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
    // Stage E can stream up to ~16k tokens of tailored CV; allow more headroom than the default 60s cap.
    await generateText(settings, apiKey, STAGE_E_SYSTEM_PROMPT, buildStageEUserPrompt({ jobAnalysis, cvJson, tailoringPlan, title, company, location }), 16384, { timeoutMs: 180_000 }),
    tailoredCvResultSchema,
    "Stage E",
  )

  if (!result.cv) throw new Error("AI returned incomplete CV data. Please try again.")

  const constrainedCv = {
    ...result.cv,
    skills: selectTailoredSkills(ctx.cvJson, tailoringPlan, result.cv.skills),
  }

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
      cvJson: normalizeObjectStrings(constrainedCv) as unknown as Json,
      atsScore: result.ats_match_estimate?.score ?? null,
      skillsGap: skillsGap as unknown as Json,
    })
    .returning({ id: customizedCvs.id })

  return inserted.id
}
