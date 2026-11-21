/**
 * The validation the interview workspace applies to stories and "about me" facts. Shared by the web server actions and
 * the MCP tools, so an agent can never save anything the owner could not save in the app.
 */

export const MAX_STORY_TITLE_LENGTH = 200
export const MAX_STORY_FIELD_LENGTH = 5000
export const MAX_FACT_LABEL_LENGTH = 200
export const MAX_FACT_DETAIL_LENGTH = 5000
export const MAX_TAG_LENGTH = 80
export const MAX_TAGS = 20

export const INTERVIEW_FACT_CATEGORIES = [
  "summary",
  "education",
  "experience",
  "project",
  "skill",
  "certification",
  "activity",
  "language",
  "achievement",
  "strengths",
  "goals",
  "personal_context",
] as const

const VALID_INTERVIEW_FACT_CATEGORIES = new Set<string>(INTERVIEW_FACT_CATEGORIES)

export function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export type ValidationOk<T> = { value: T; error?: never }
export type ValidationError = { error: string; value?: never }
export type ValidationResult<T> = ValidationOk<T> | ValidationError

export function normalizeText(
  label: string,
  value: unknown,
  maxLength: number,
  options: { required?: boolean } = {},
): ValidationResult<string> {
  const text = trim(value)
  if (!text) {
    return options.required === false ? { value: "" } : { error: `${label} is required` }
  }
  if (text.length > maxLength) return { error: `${label} is too long` }
  return { value: text }
}

export function normalizeTags(value: unknown): ValidationResult<string[]> {
  if (value == null) return { value: [] }
  if (!Array.isArray(value)) return { error: "Tags are invalid" }
  if (value.length > MAX_TAGS) return { error: "Tags are invalid" }

  const tags: string[] = []
  for (const rawTag of value) {
    const tag = trim(rawTag)
    if (!tag || tag.length > MAX_TAG_LENGTH || tags.includes(tag)) {
      return { error: "Tags are invalid" }
    }
    tags.push(tag)
  }

  return { value: tags }
}

export function isAllowedFactCategory(value: unknown): value is string {
  return typeof value === "string" && VALID_INTERVIEW_FACT_CATEGORIES.has(value.trim())
}
