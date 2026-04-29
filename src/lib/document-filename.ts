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

export function buildCoverLetterFilenameBase({
  fullName,
  company,
  role,
}: CvFilenameParts): string {
  const parts = [
    cleanFilenamePart(fullName),
    cleanFilenamePart(company),
    cleanFilenamePart(role),
    "Cover Letter",
  ].filter((part): part is string => Boolean(part))

  return parts.join(" - ")
}

export function withPdfExtension(filenameBase: string): string {
  const cleaned = cleanFilenamePart(filenameBase) ?? "document"
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`
}

function asciiFilenameFallback(filename: string): string {
  return (
    filename
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, " ")
      .replace(/["\\;]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "document.pdf"
  )
}

export function buildAttachmentContentDisposition(filenameBase: string): string {
  const filename = withPdfExtension(filenameBase)
  const fallback = asciiFilenameFallback(filename)

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}
