import type { PersistedJobInput } from "@/lib/jobs/persist-job"
import { detectRemoteType } from "@/lib/jobs/remote-detection"

interface GreenhouseJob {
  id: number
  title: string
  location: { name: string } | null
  absolute_url: string
  content: string | null
  updated_at: string | null
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[]
}

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export async function fetchGreenhouseJobs(boardSlug: string, companyName: string): Promise<PersistedJobInput[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardSlug)}/jobs?content=true`
  const res = await fetch(url, {
    headers: { "User-Agent": "Jobclock/1.0" },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`Greenhouse API error for board "${boardSlug}": ${res.status}`)
  }

  const data = (await res.json()) as GreenhouseResponse

  return data.jobs.map((job) => {
    const description = stripHtml(job.content)
    const location = job.location?.name ?? null
    const { isRemote, remoteType } = detectRemoteType(job.title, location, description)

    return {
      url: job.absolute_url,
      source: "greenhouse",
      title: job.title,
      company: companyName,
      location,
      description,
      postedAt: job.updated_at ?? null,
      salaryCurrency: "GBP",
      isEasyApply: false,
      isRemote,
      remoteType,
    } satisfies PersistedJobInput
  })
}
