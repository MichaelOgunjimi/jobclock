/**
 * Strips markdown artifacts from AI-generated cover letter text so it renders
 * as clean prose. The AI prompt already asks for plain text but models
 * occasionally output dashes, bold markers, headings, etc.
 */
export function normalizeCoverLetterText(raw: string): string {
  return raw
    .split("\n")
    .map((line) => {
      // Remove heading markers: ## Heading → Heading
      line = line.replace(/^#{1,6}\s+/, "")
      // Remove bullet/dash list markers at line start: - item / * item
      line = line.replace(/^[-*]\s+/, "")
      // Remove ordered list markers: 1. item
      line = line.replace(/^\d+\.\s+/, "")
      // Strip bold: **text** → text
      line = line.replace(/\*\*(.+?)\*\*/g, "$1")
      // Strip italic: *text* or _text_ → text (but not standalone * or _)
      line = line.replace(/\*(.+?)\*/g, "$1")
      line = line.replace(/_(.+?)_/g, "$1")
      // Strip inline code: `code` → code
      line = line.replace(/`(.+?)`/g, "$1")
      return line
    })
    .join("\n")
    // Collapse 3+ consecutive blank lines down to 2
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
