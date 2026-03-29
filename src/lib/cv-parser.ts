import type { CvData, CvExperience } from "./supabase/database.types"

/**
 * Parse a CV text blob into structured CvData.
 * This is a rule-based parser for Phase 1.
 * Phase 2 will replace this with Claude AI parsing.
 */
export function parseCvText(text: string): CvData {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)

  const cv: CvData = {
    experience: [],
    education: [],
    skills: [],
  }
  const experience = cv.experience ?? []

  // Try to extract name (first substantial non-section line)
  if (lines.length > 0) {
    cv.name = lines[0]
  }

  let currentSection: "experience" | "education" | "skills" | "summary" | null = null
  let currentBlock: Partial<CvExperience> = {}

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const lower = line.toLowerCase()

    // Section detection
    if (lower.startsWith("experience") || lower.startsWith("work history") || lower.startsWith("employment")) {
      if (currentBlock.company && currentSection === "experience") {
        experience.push(currentBlock as CvExperience)
        currentBlock = {}
      }
      currentSection = "experience"
      continue
    }

    if (lower.startsWith("education") || lower.startsWith("academic") || lower.startsWith("qualification")) {
      if (currentBlock.company && currentSection === "experience") {
        experience.push(currentBlock as CvExperience)
        currentBlock = {}
      }
      currentSection = "education"
      continue
    }

    if (lower.startsWith("skill") || lower === "skills") {
      currentSection = "skills"
      continue
    }

    if (lower.startsWith("summary") || lower.startsWith("profile") || lower.startsWith("about")) {
      currentSection = "summary"
      continue
    }

    // Content lines
    if (currentSection === "skills") {
      // Comma or bullet separated skills
      const skills = line.split(/[,;•|·]/).map((s) => s.trim()).filter(Boolean)
      cv.skills.push(...skills)
      continue
    }

    if (currentSection === "summary") {
      cv.summary = (cv.summary || "") + " " + line
      continue
    }

    if (currentSection === "experience") {
      // Try to detect job entry start (Company | Title or Title at Company)
      if (line.includes("|") || (i > 0 && lines[i - 1]?.toLowerCase().startsWith("experience"))) {
        if (currentBlock.company) {
          experience.push(currentBlock as CvExperience)
        }
        const parts = line.split("|").map((p) => p.trim())
        currentBlock = {
          company: parts[0] || line,
          title: parts[1] || "",
          description: "",
        }
      } else {
        // Append as description
        currentBlock.description = (currentBlock.description || "") + " " + line
      }
      continue
    }

    if (currentSection === "education") {
      if (line.includes("|") || (i > 0 && lines[i - 1]?.toLowerCase().startsWith("education"))) {
        const parts = line.split("|").map((p) => p.trim())
        cv.education.push({
          institution: parts[0] || line,
          degree: parts[1] || "",
        })
      }
      continue
    }

    // Fallback: if no section detected, treat as skills or name
    if (!currentSection && i === 1 && !cv.email) {
      // Try to find email
      const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/)
      if (emailMatch) cv.email = emailMatch[0]

      const phoneMatch = text.match(/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/)
      if (phoneMatch) cv.phone = phoneMatch[0]
    }
  }

  // Push last block
  if (currentBlock.company) {
    experience.push(currentBlock as CvExperience)
  }

  // Deduplicate skills
  cv.skills = [...new Set(cv.skills.map((s) => s.toLowerCase()))]

  return cv
}
