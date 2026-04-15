import { extractJson } from "./extract-json"
import { generateText, resolveAiConfig, type UserPreferences } from "./index"
import { CV_PARSER_SYSTEM_PROMPT, buildCvParserUserPrompt } from "./prompts/cv-parser"
import { cvDataSchema } from "./cv-tailoring-schemas"
import type { CvData } from "@/lib/supabase/database.types"


export async function parseCvWithAi(
  rawText: string,
  preferences: UserPreferences | null
): Promise<CvData> {
  const { settings, apiKey } = resolveAiConfig(preferences)

  const response = await generateText(
    settings,
    apiKey,
    CV_PARSER_SYSTEM_PROMPT,
    buildCvParserUserPrompt(rawText)
  )

  // Strip markdown code fences if the model added them anyway
  const cleaned = response
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()

  let extracted: unknown
  try {
    extracted = extractJson(cleaned)
  } catch {
    throw new Error("CV parsing failed: AI returned unparseable JSON. Please try again.")
  }

  // Validate and coerce through Zod to clean up AI output
  const result = cvDataSchema.safeParse(extracted)
  if (!result.success) {
    console.error("[CV Parser] Zod validation failed:", result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "))
    throw new Error("CV parsing failed: AI returned invalid structure. Please try again.")
  }

  return result.data as CvData
}
