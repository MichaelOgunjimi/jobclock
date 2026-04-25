import type { PersistedJobInput } from "@/lib/jobs/persist-job"
import { detectRemoteType } from "@/lib/jobs/remote-detection"

interface AshbyJob {
  id: string
  title: string
  jobUrl: string
  publishedDate: string | null
  descriptionHtml: string | null
  isRemote: boolean
  location: string | null
}

interface AshbyResponse {
  jobs: AshbyJob[]
}

function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

export async function fetchAshbyJobs(orgSlug: string, companyName: string): Promise<PersistedJobInput[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(orgSlug)}`
  const res = await fetch(url, {
    headers: { "User-Agent": "Jobclock/1.0" },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`Ashby API error for org "${orgSlug}": ${res.status}`)
  }

  const data = (await res.json()) as AshbyResponse

  return data.jobs.map((job) => {
    const description = stripHtml(job.descriptionHtml)
    const { remoteType } = detectRemoteType(job.title, job.location, description)

    return {
      url: job.jobUrl,
      source: "ashby",
      title: job.title,
      company: companyName,
      location: job.location ?? null,
      description,
      postedAt: job.publishedDate ?? null,
      salaryCurrency: "GBP",
      isEasyApply: false,
      isRemote: job.isRemote,
      remoteType: job.isRemote && !remoteType ? "remote" : remoteType,
    } satisfies PersistedJobInput
  })
}
