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

        // Experience with full bullet points — not just description
        params.cv.experience?.length
          ? [
              "Experience:",
              ...params.cv.experience.map((e) => {
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
        params.cv.projects?.length
          ? [
              "Projects:",
              ...params.cv.projects.map((p) => {
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

        params.cv.education?.length
          ? [
              "Education:",
              ...params.cv.education.map(
                (e) =>
                  `  - ${e.degree}${e.field ? ` in ${e.field}` : ""} at ${e.institution}` +
                  `${e.end_date ? ` (${e.end_date})` : ""}${e.grade ? `, ${e.grade}` : ""}` +
                  `${e.relevant_modules?.length ? `\n    Modules: ${e.relevant_modules.join(", ")}` : ""}`
              ),
            ].join("\n")
          : null,

        params.cv.certifications?.length
          ? `Certifications: ${params.cv.certifications.join(", ")}`
          : null,

        params.cv.activities?.length
          ? [
              "Activities & Volunteering:",
              ...params.cv.activities.map(
                (a) =>
                  `  - ${a.title} at ${a.company}` +
                  `${a.start_date ? ` (${a.start_date}–${a.end_date ?? "present"})` : ""}` +
                  `${a.description ? `: ${a.description}` : ""}`
              ),
            ].join("\n")
          : null,
      ]
    : [
        "",
        "No CV selected for this application yet. The user can upload or select one in the application settings.",
        "You can still help with company research, general interview tips, and cover letter guidance.",
      ]

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
    ...cvLines,
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
    .filter((l) => l !== null)
    .join("\n")
}
