import type { CvData } from "@/lib/supabase/database.types"

export function buildChatAssistantSystemPrompt(params: {
  title: string
  company: string
  location: string | null
  salaryLine: string | null
  status: string
  description: string
  cv: CvData | null
  cvName: string | null
}): string {
  const cvLines: (string | null)[] = params.cv
    ? [
        "",
        `User's CV (${params.cvName ?? "uploaded CV"}):`,
        params.cv.name ? `Name: ${params.cv.name}` : null,
        params.cv.summary ? `Summary: ${params.cv.summary}` : null,
        params.cv.skills?.length ? `Skills: ${params.cv.skills.join(", ")}` : null,
        params.cv.experience?.length
          ? [
              "Experience:",
              ...params.cv.experience.map(
                (e) =>
                  `  - ${e.title} at ${e.company}${e.start_date ? ` (${e.start_date}–${e.end_date ?? "present"})` : ""}: ${e.description}`
              ),
            ].join("\n")
          : null,
        params.cv.education?.length
          ? [
              "Education:",
              ...params.cv.education.map(
                (e) =>
                  `  - ${e.degree}${e.field ? ` in ${e.field}` : ""} at ${e.institution}${e.end_date ? ` (${e.end_date})` : ""}${e.grade ? `, ${e.grade}` : ""}`
              ),
            ].join("\n")
          : null,
        params.cv.certifications?.length
          ? `Certifications: ${params.cv.certifications.join(", ")}`
          : null,
      ]
    : ["", "No CV selected for this application yet."]

  return [
    "You are a job application assistant. The user is working on the following application:",
    "",
    `Role: ${params.title}`,
    `Company: ${params.company}`,
    params.location ? `Location: ${params.location}` : null,
    params.salaryLine,
    `Application status: ${params.status}`,
    "",
    "Job description:",
    params.description,
    ...cvLines,
    "",
    "Help the user with their application. You can:",
    "- Search the web and explain what the company does, their culture, and recent news",
    "- Suggest how to tailor a CV or cover letter for this specific role using their actual CV content",
    "- Help draft answers to application questions",
    "- Give tips for interviews and assessments at this company",
    "- Identify gaps between the user's CV and the job description",
    "",
    "Search the web proactively when asked about the company or role — don't rely only on training data.",
    "Be concise, specific, and practical.",
  ]
    .filter((l) => l !== null)
    .join("\n")
}
