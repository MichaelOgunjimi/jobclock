import { extractJson } from "./extract-json"
import { generateText, resolveAiConfig, type UserPreferences } from "./index"
import { CV_REVIEW_SYSTEM_PROMPT, buildCvReviewUserPrompt } from "./prompts/cv-review"
import { reviewFindingsResponseSchema, type CvReviewFinding } from "./cv-review-schemas"
import type { CvData } from "@/lib/supabase/database.types"

export async function reviewCv(
  cv: CvData,
  preferences: UserPreferences | null,
): Promise<CvReviewFinding[]> {
  const { settings, apiKey } = resolveAiConfig(preferences)

  const response = await generateText(
    settings,
    apiKey,
    CV_REVIEW_SYSTEM_PROMPT,
    buildCvReviewUserPrompt(JSON.stringify(cv)),
  )

  const cleaned = response
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()

  let extracted: unknown
  try {
    extracted = extractJson(cleaned)
  } catch {
    throw new Error("CV review failed: AI returned unparseable JSON.")
  }

  const result = reviewFindingsResponseSchema.safeParse(extracted)
  if (!result.success) {
    throw new Error("CV review failed: AI returned invalid finding structure.")
  }

  return result.data.findings
}
