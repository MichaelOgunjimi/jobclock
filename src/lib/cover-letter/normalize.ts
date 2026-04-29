import { normalizeForAts } from "@/lib/cv/normalize"

const MARKDOWN_LINE_PATTERNS: Array<[RegExp, string]> = [
  // Strip heading markers: ## Heading → Heading
  [/^#{1,6}\s+/, ""],
  // Strip bullet/dash list markers: - item / * item
  [/^[-*]\s+/, ""],
  // Strip ordered list markers: 1. item
  [/^\d+\.\s+/, ""],
  // Strip bold: **text** → text
  [/\*\*(.+?)\*\*/g, "$1"],
  // Strip italic: *text* or _text_ → text
  [/\*(.+?)\*/g, "$1"],
  [/_(.+?)_/g, "$1"],
  // Strip inline code: `code` → code
  [/`(.+?)`/g, "$1"],
]

/**
 * Normalises AI-generated cover letter text to clean prose.
 * Strips markdown artifacts (bullets, bold, headings) and applies the same
 * ATS character normalisation used for CVs (smart quotes, em dashes, ligatures).
 */
export function normalizeCoverLetterText(raw: string): string {
  const stripped = raw
    .split("\n")
    .map((line) => {
      for (const [pattern, replacement] of MARKDOWN_LINE_PATTERNS) {
        line = line.replace(pattern, replacement)
      }
      return line
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return normalizeForAts(stripped)
}
