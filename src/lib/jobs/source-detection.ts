const KNOWN_ATS_HOSTS: Array<{ pattern: RegExp; source: string }> = [
  { pattern: /(^|\.)greenhouse\.io$/i, source: "greenhouse" },
  { pattern: /(^|\.)lever\.co$/i, source: "lever" },
  { pattern: /(^|\.)ashbyhq\.com$/i, source: "ashby" },
  { pattern: /(^|\.)myworkdayjobs\.com$/i, source: "workday" },
  { pattern: /(^|\.)smartrecruiters\.com$/i, source: "smartrecruiters" },
  { pattern: /(^|\.)jobvite\.com$/i, source: "jobvite" },
]

function normalizeHostname(hostname: string): string {
  const cleanHost = hostname.replace(/^www\./i, "").toLowerCase()

  for (const candidate of KNOWN_ATS_HOSTS) {
    if (candidate.pattern.test(cleanHost)) return candidate.source
  }

  const parts = cleanHost.split(".").filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`
  }

  return cleanHost
}

export function detectSourceFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname
    return normalizeHostname(hostname) || "external"
  } catch {
    return "external"
  }
}

export interface AtsDetectionResult {
  atsType: "greenhouse" | "lever" | "ashby" | "workday" | "unknown" | null
  boardIdentifier: string | null
}

export function detectAtsFromUrl(rawUrl: string): AtsDetectionResult {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { atsType: null, boardIdentifier: null }
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
  const path = parsed.pathname

  // Greenhouse: boards.greenhouse.io/SLUG or boards-api.greenhouse.io/v1/boards/SLUG
  // or SLUG.greenhouse.io (custom domain embed is rare but handle it)
  if (host === "boards.greenhouse.io" || host === "boards-api.greenhouse.io" || host === "job-boards.greenhouse.io" || host === "job-boards.eu.greenhouse.io") {
    // path: /SLUG or /embed/job_board (with ?for=SLUG) or /v1/boards/SLUG/jobs
    const forParam = parsed.searchParams.get("for")
    if (forParam) return { atsType: "greenhouse", boardIdentifier: forParam }
    const boardsMatch = path.match(/\/(?:v\d+\/boards\/)?([^/]+?)(?:\/jobs)?(?:\/|$)/)
    const slug = boardsMatch?.[1] ?? null
    return { atsType: "greenhouse", boardIdentifier: slug && slug !== "embed" ? slug : null }
  }

  if (host.endsWith(".greenhouse.io")) {
    const slug = host.split(".")[0]
    return { atsType: "greenhouse", boardIdentifier: slug || null }
  }

  // Lever: jobs.lever.co/SLUG
  if (host === "jobs.lever.co") {
    const slug = path.split("/").filter(Boolean)[0] ?? null
    return { atsType: "lever", boardIdentifier: slug }
  }

  // Ashby: jobs.ashbyhq.com/SLUG or SLUG.ashbyhq.com
  if (host === "jobs.ashbyhq.com") {
    const slug = path.split("/").filter(Boolean)[0] ?? null
    return { atsType: "ashby", boardIdentifier: slug }
  }

  if (host.endsWith(".ashbyhq.com")) {
    const slug = host.split(".")[0]
    return { atsType: "ashby", boardIdentifier: slug || null }
  }

  // Workday: {subdomain}.myworkdayjobs.com/{companyId}/...
  // For Workday, boardIdentifier stores the full URL (the CXS endpoint needs it)
  if (host.endsWith(".myworkdayjobs.com")) {
    return { atsType: "workday", boardIdentifier: rawUrl }
  }

  return { atsType: "unknown", boardIdentifier: null }
}
