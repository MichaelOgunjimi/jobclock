interface CvFilenameParts {
  fullName?: string | null
  company?: string | null
  role?: string | null
}

function cleanFilenamePart(value: string | null | undefined): string | null {
  const cleaned = value
    ?.replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return cleaned || null
}

export function buildCvFilenameBase({
  fullName,
  company,
  role,
}: CvFilenameParts): string {
  const parts = [
    cleanFilenamePart(fullName),
    cleanFilenamePart(company),
    cleanFilenamePart(role),
    "CV",
  ].filter((part): part is string => Boolean(part))

  return parts.join(" - ")
}

export function withPdfExtension(filenameBase: string): string {
  const cleaned = cleanFilenamePart(filenameBase) ?? "document"
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`
}
