import type { PersistedJobInput } from "@/lib/jobs/persist-job"
import { detectRemoteType } from "@/lib/jobs/remote-detection"

// Parses a Workday careers URL into the CXS API config.
// Workday URLs follow: https://{subdomain}.myworkdayjobs.com/{companyId}/jobs
// The internal API lives at:  https://{subdomain}.myworkdayjobs.com/wday/cxs/{subdomain}/{companyId}/jobs
function parseWorkdayUrl(careersUrl: string): { cxsUrl: string; baseUrl: string } | null {
  try {
    const parsed = new URL(careersUrl)
    if (!parsed.hostname.endsWith(".myworkdayjobs.com")) return null

    const subdomain = parsed.hostname.split(".")[0]
    const pathParts = parsed.pathname.split("/").filter(Boolean)
    if (pathParts.length === 0) return null

    const companyId = pathParts[0]
    const origin = parsed.origin
    return {
      cxsUrl: `${origin}/wday/cxs/${subdomain}/${companyId}/jobs`,
      baseUrl: `${origin}/${companyId}`,
    }
  } catch {
    return null
  }
}

interface WorkdayPosting {
  title?: string
  externalPath?: string
  postedOn?: string
  locationsText?: string
}

interface WorkdayResponse {
  jobPostings?: WorkdayPosting[]
  total?: number
}

const PAGE_SIZE = 20
const MAX_PAGES = 25

export async function fetchWorkdayJobs(careersUrl: string, companyName: string): Promise<PersistedJobInput[]> {
  const config = parseWorkdayUrl(careersUrl)
  if (!config) throw new Error(`Cannot parse Workday URL: ${careersUrl}`)

  const allJobs: PersistedJobInput[] = []
  let offset = 0

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(config.cxsUrl, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit: PAGE_SIZE, offset, searchText: "" }),
      next: { revalidate: 0 },
    })

    if (!res.ok) throw new Error(`Workday API error ${res.status} for ${careersUrl}`)

    const data = (await res.json()) as WorkdayResponse
    const postings = data.jobPostings ?? []
    if (postings.length === 0) break

    for (const posting of postings) {
      const externalPath = posting.externalPath
      if (!externalPath) continue

      const jobUrl = externalPath.startsWith("http")
        ? externalPath
        : `${config.baseUrl}${externalPath.startsWith("/") ? "" : "/"}${externalPath}`

      const title = posting.title?.trim() ?? "Untitled Position"
      const location = posting.locationsText?.trim() ?? null
      const { isRemote, remoteType } = detectRemoteType(title, location, null)

      allJobs.push({
        url: jobUrl,
        source: "workday",
        title,
        company: companyName,
        location,
        description: null,
        postedAt: null,
        salaryCurrency: "GBP",
        isEasyApply: false,
        isRemote,
        remoteType,
      } satisfies PersistedJobInput)
    }

    if (postings.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return allJobs
}
