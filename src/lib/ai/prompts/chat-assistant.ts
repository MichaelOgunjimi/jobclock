import type { CvData } from "@/lib/supabase/database.types"

function formatCv(cv: CvData, label: string): string[] {
  return [
    "",
    `--- ${label} ---`,
    cv.name ? `Name: ${cv.name}` : null,
    cv.summary ? `Summary: ${cv.summary}` : null,
    cv.skills?.length ? `Skills: ${cv.skills.join(", ")}` : null,

    // Experience with full bullet points — not just description
    cv.experience?.length
      ? [
          "Experience:",
          ...cv.experience.map((e) => {
            const header = `  - ${e.title} at ${e.company}${e.start_date ? ` (${e.start_date}–${e.end_date ?? "present"})` : ""}`
            const desc = e.description ? `\n    Summary: ${e.description}` : ""
            const highlights =
              e.highlights?.length
                ? `\n    Key points:\n${e.highlights.map((h) => `      • ${h}`).join("\n")}`
                : ""
            return header + desc + highlights
          }),
        ].join("\n")
      : null,

    // Projects — critical context for recent graduates and career changers
    cv.projects?.length
      ? [
          "Projects:",
          ...cv.projects.map((p) => {
            const header = `  - ${p.name}${p.start_date ? ` (${p.start_date}–${p.end_date ?? "present"})` : ""}`
            const desc = p.description ? `\n    Summary: ${p.description}` : ""
            const tech =
              p.technologies?.length
                ? `\n    Technologies: ${p.technologies.join(", ")}`
                : ""
            const highlights =
              p.highlights?.length
                ? `\n    Key points:\n${p.highlights.map((h) => `      • ${h}`).join("\n")}`
                : ""
            return header + desc + tech + highlights
          }),
        ].join("\n")
      : null,

    cv.education?.length
      ? [
          "Education:",
          ...cv.education.map(
            (e) =>
              `  - ${e.degree}${e.field ? ` in ${e.field}` : ""} at ${e.institution}` +
              `${e.end_date ? ` (${e.end_date})` : ""}${e.grade ? `, ${e.grade}` : ""}` +
              `${e.relevant_modules?.length ? `\n    Modules: ${e.relevant_modules.join(", ")}` : ""}`
          ),
        ].join("\n")
      : null,

    cv.certifications?.length
      ? `Certifications: ${cv.certifications.join(", ")}`
      : null,

    cv.activities?.length
      ? [
          "Activities & Volunteering:",
          ...cv.activities.map(
            (a) =>
              `  - ${a.title} at ${a.company}` +
              `${a.start_date ? ` (${a.start_date}–${a.end_date ?? "present"})` : ""}` +
              `${a.description ? `: ${a.description}` : ""}`
          ),
        ].join("\n")
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
    } else {
      cvSection.push("", "Tailored CV: not generated yet for this role.")
    }
    if (params.baseCv && params.tailoredCv) {
      cvSection.push("", "When suggesting improvements, reference the tailored CV for this role and the main CV for the full picture.")
    }
  }

  return [
    "You are a job application assistant helping a candidate apply for a specific role.",
    "The user is working on the following application:",
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
    "Your capabilities — help the user with any of the following:",
    "- Research the company: what they do, their culture, recent news, and what they typically look for in candidates",
    "- Analyse how well the user's background matches this specific role, citing actual CV content and JD requirements",
    "- Suggest targeted improvements to CV bullets, summary, or skills for this role — provide ready-to-use text, not vague suggestions",
    "- Draft or refine cover letter paragraphs that are specific, evidence-based, and grounded in the user's real background",
    "- Help write answers to application screening questions",
    "- Generate targeted interview prep: likely questions this company asks and strong answers based on the user's actual experience",
    "- Identify genuine skills gaps and suggest honest, practical ways to address them",
    "",
    "Response guidelines:",
    "- Always refer to the actual job description and the user's actual CV content — never give generic advice",
    "- When reviewing fit, lead with genuine strengths, then address real gaps honestly",
    "- When drafting content (cover letter paragraphs, CV bullets, screening answers), produce polished, ready-to-use text",
    "- Use British English spelling and UK professional conventions in all content you draft",
    "- Be direct and specific — if something in the CV is weak for this role, say so clearly and suggest a fix",
    "- Keep responses focused — answer what was asked, then offer one clear next step if helpful",
    "",
    "Always search the web when asked about the company or role — do not rely solely on training data.",
  ]
    .filter((l): l is string => l !== null)
    .join("\n")
}
