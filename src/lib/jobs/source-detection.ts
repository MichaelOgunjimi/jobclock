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
