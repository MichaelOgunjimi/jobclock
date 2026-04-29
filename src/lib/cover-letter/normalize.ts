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

// Character-level normalizations for prose — same as normalizeForAts but
// WITHOUT the dash rule so em dashes (—) and en dashes (–) are preserved.
const PROSE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[''‚‛]/g, "'"],
  [/[""„‟]/g, '"'],
  // Em dash, en dash, horizontal bar — remove entirely
  [/\s*[–—―]\s*/g, " "],
  [/…/g, "..."],
  [/ /g, " "],
  [/[•‣⁃∙◦⁌⁍]/g, "-"],
  [/ﬁ/g, "fi"],
  [/ﬂ/g, "fl"],
  [/[​‌‍﻿]/g, ""],
]

/**
 * Normalises AI-generated cover letter text to clean prose.
 * Strips markdown artifacts (bullets, bold, headings) and normalises
 * characters (smart quotes, ligatures, zero-width chars).
 * Unlike normalizeForAts, em dashes and en dashes are kept as-is.
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

  let result = stripped
  for (const [pattern, replacement] of PROSE_REPLACEMENTS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

// Re-export for use elsewhere if needed
export { normalizeForAts }
