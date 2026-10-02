const URL_PATTERN = /https?:\/\/[^\s<>"']+/i

export function extractFirstJobUrl(body: string): string | null {
  const matched = body.match(URL_PATTERN)?.[0]?.replace(/[),.;!?]+$/, "")
  if (!matched) return null

  try {
    const url = new URL(matched)
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}
