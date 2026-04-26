import type { CvData } from "@/lib/supabase/database.types"

function formatCv(cv: CvData, label: string): string[] {
  return [
    "",
    `--- ${label} ---`,
    cv.name ? `Name: ${cv.name}` : null,
    cv.summary ? `Summary: ${cv.summary}` : null,
    cv.skills?.length ? `Skills: ${cv.skills.join(", ")}` : null,
    cv.experience?.length
      ? [
          "Experience:",
          ...cv.experience.map(
            (e) =>
              `  - ${e.title} at ${e.company}${e.start_date ? ` (${e.start_date}–${e.end_date ?? "present"})` : ""}: ${e.description}`
          ),
        ].join("\n")
      : null,
    cv.education?.length
      ? [
          "Education:",
          ...cv.education.map(
            (e) =>
              `  - ${e.degree}${e.field ? ` in ${e.field}` : ""} at ${e.institution}${e.end_date ? ` (${e.end_date})` : ""}${e.grade ? `, ${e.grade}` : ""}`
          ),
        ].join("\n")
      : null,
    cv.certifications?.length
      ? `Certifications: ${cv.certifications.join(", ")}`
      : null,
  ].filter((l): l is string => l !== null)
}

export function buildChatAssistantSystemPrompt(params: {
  title: string
  company: string
  location: string | null
  salaryLine: string | null
  status: string
  description: string
  baseCv: CvData | null
  baseCvName: string | null
  tailoredCv: CvData | null
}): string {
  const cvSection: string[] = []

  if (!params.baseCv && !params.tailoredCv) {
    cvSection.push("", "No CV uploaded yet.")
  } else {
    if (params.baseCv) {
      cvSection.push(...formatCv(params.baseCv, `Main CV${params.baseCvName ? ` — ${params.baseCvName}` : ""}`))
    }
    if (params.tailoredCv) {
      cvSection.push(...formatCv(params.tailoredCv, "Tailored CV — AI-customised for this specific role"))
    }
    if (params.baseCv && params.tailoredCv) {
      cvSection.push("", "When suggesting improvements, reference the tailored CV for this role and the main CV for the full picture.")
    }
  }

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
    ...cvSection,
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
    .filter((l): l is string => l !== null)
    .join("\n")
}
