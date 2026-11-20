/**
 * Canonical form of a job posting URL, so the same posting reached through different links compares equal:
 * http(s) only, lowercase host, default port, fragment, trailing slash and well-known tracking parameters removed,
 * remaining parameters sorted. Parameters that can identify the job (gh_jid, currentJobId, id...) are kept.
 * Returns null for anything that is not a plain http(s) URL (javascript:, data:, file:, credentials in the URL...).
 * Pure string work: it never resolves or fetches the URL.
 */
const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "dclid", "msclkid", "twclid", "igshid", "li_fat_id", "mc_cid", "mc_eid",
  "_hsenc", "_hsmi", "ref", "ref_src", "refid", "referrer", "trk", "trkinfo", "trackingid",
  "gh_src", "lever-source", "lever-origin",
])

export function normalizeJobUrl(raw: string): string | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  if (url.username || url.password || !url.hostname) return null

  url.hash = ""
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key)
  }
  url.searchParams.sort()
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, "")}${url.search}`
}

/** Scheme-insensitive comparison key: http and https links to the same posting are the same job. */
export const jobUrlKey = (normalized: string) => normalized.replace(/^https?:\/\//, "")
