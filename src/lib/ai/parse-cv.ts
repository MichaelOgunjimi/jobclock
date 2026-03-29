import { generateText, resolveAiSettings, resolveApiKey, type UserPreferences } from "./index"
import type { CvData } from "@/lib/supabase/database.types"

const SYSTEM_PROMPT = `You are an expert CV/resume parser. Extract all information from the CV text provided and return it as valid JSON only — no markdown fences, no explanation, just the raw JSON object.

IMPORTANT DISTINCTION:
- "experience" = paid work history only (full-time jobs, part-time jobs, internships, contracts at actual companies/organisations)
- "projects" = personal projects, side projects, open-source contributions, academic projects, hackathon entries, portfolio work — anything NOT a paid job at an employer
- Do NOT put projects in the experience array. Do NOT put jobs in the projects array.`

function buildPrompt(rawText: string): string {
  return `Parse this CV and return a JSON object with exactly this structure. Include every piece of information you can find. Use null for missing optional scalar fields and empty arrays for missing array fields.

{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "+44 7xxx xxxxxx",
  "location": "City, Country",
  "summary": "Professional summary or personal statement",
  "experience": [
    {
      "company": "Acme Corp",
      "title": "Software Engineer",
      "start_date": "Jan 2022",
      "end_date": "Dec 2023 or null if current",
      "description": "What you did in this role",
      "highlights": ["Key achievement"]
    }
  ],
  "education": [
    {
      "institution": "University of Manchester",
      "degree": "BSc Computer Science",
      "field": "Computer Science",
      "start_date": "2019",
      "end_date": "2023",
      "grade": "First Class"
    }
  ],
  "projects": [
    {
      "name": "Project Name",
      "description": "One-line summary of the project",
      "highlights": ["Key achievement or feature", "Another bullet point"],
      "technologies": ["React", "Node.js"],
      "url": "https://github.com/... or null",
      "start_date": "2023 or null",
      "end_date": "2024 or null"
    }
  ],
  "skills": ["JavaScript", "Python"],
  "languages": ["English", "French"],
  "certifications": ["AWS Solutions Architect"]
}

CV TEXT:
${rawText}`
}

export async function parseCvWithAi(
  rawText: string,
  preferences: UserPreferences | null
): Promise<CvData> {
  const settings = resolveAiSettings(preferences)
  const apiKey = resolveApiKey(settings.provider, preferences)

  const response = await generateText(
    settings,
    apiKey,
    SYSTEM_PROMPT,
    buildPrompt(rawText)
  )

  // Strip markdown code fences if the model added them anyway
  const cleaned = response
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()

  const parsed = JSON.parse(cleaned) as Partial<CvData>

  return {
    name: parsed.name ?? undefined,
    email: parsed.email ?? undefined,
    phone: parsed.phone ?? undefined,
    location: parsed.location ?? undefined,
    summary: parsed.summary ?? undefined,
    experience: parsed.experience ?? [],
    education: parsed.education ?? [],
    projects: parsed.projects ?? [],
    skills: parsed.skills ?? [],
    languages: parsed.languages ?? [],
    certifications: parsed.certifications ?? [],
  }
}
