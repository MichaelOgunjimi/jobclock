import { extractJson } from "./extract-json"
import { generateText, resolveAiConfig, type UserPreferences } from "./index"
import { CV_PARSER_SYSTEM_PROMPT, buildCvParserUserPrompt } from "./prompts/cv-parser"
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

  let parsed: Partial<CvData>
  try {
    parsed = extractJson(cleaned) as Partial<CvData>
  } catch {
    throw new Error("CV parsing failed: AI returned unparseable JSON. Please try again.")
  }

  return {
    name: parsed.name ?? undefined,
    email: parsed.email ?? undefined,
    phone: parsed.phone ?? undefined,
    location: parsed.location ?? undefined,
    linkedin: parsed.linkedin ?? undefined,
    website: parsed.website ?? undefined,
    summary: parsed.summary ?? undefined,
    experience: parsed.experience ?? [],
    education: parsed.education ?? [],
    projects: parsed.projects ?? [],
    skills: parsed.skills ?? [],
    languages: parsed.languages ?? [],
    certifications: parsed.certifications ?? [],
    activities: parsed.activities ?? [],
  }
}
