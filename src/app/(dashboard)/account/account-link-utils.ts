export function toExternalProfileHref(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed || trimmed.startsWith("//")) return null

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
  if (!hasScheme && !/^[^\s]+\.[^\s]+$/.test(trimmed)) {
    return null
  }

  try {
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}
