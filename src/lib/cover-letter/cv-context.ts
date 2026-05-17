import type { CvData } from "@/lib/supabase/database.types"

/** Renders a parsed CV into the plain-text background block used by the
 *  cover-letter prompt. Pure; shared by the server action and the async
 *  generation handler. */
export function buildCvContext(cv: CvData | null): string {
  if (!cv) return ""
  const parts: string[] = []

  if (cv.skills?.length) {
    parts.push(`Skills: ${cv.skills.join(", ")}`)
  }

  if (cv.experience?.length) {
    const expLines = cv.experience.map((e) => {
      let line = `- ${e.title} at ${e.company}`
      if (e.start_date || e.end_date) {
        line += ` (${[e.start_date, e.end_date ?? "Present"].filter(Boolean).join(" – ")})`
      }
      if (e.highlights?.length) line += `\n  Key achievements: ${e.highlights.join("; ")}`
      return line
    })
    parts.push(`Experience:\n${expLines.join("\n")}`)
  }

  if (cv.education?.length) {
    const eduLines = cv.education.map((e) => {
      let line = `- ${e.degree}${e.field ? ` in ${e.field}` : ""} — ${e.institution}`
      if (e.gpa) line += ` (GPA: ${e.gpa})`
      if (e.honors) line += ` (${e.honors})`
      return line
    })
    parts.push(`Education:\n${eduLines.join("\n")}`)
  }

  if (cv.projects?.length) {
    const projLines = cv.projects.map((p) => {
      let line = `- ${p.name}: ${p.description}`
      if (p.highlights?.length) line += ` — ${p.highlights.join("; ")}`
      return line
    })
    parts.push(`Projects:\n${projLines.join("\n")}`)
  }

  if (cv.certifications?.length) {
    parts.push(`Certifications: ${cv.certifications.join(", ")}`)
  }

  if (cv.languages?.length) {
    parts.push(`Languages: ${cv.languages.join(", ")}`)
  }

  return parts.join("\n\n")
}
