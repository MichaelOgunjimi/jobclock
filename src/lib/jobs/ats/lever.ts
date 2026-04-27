import type { PersistedJobInput } from "@/lib/jobs/persist-job"
import { detectRemoteType } from "@/lib/jobs/remote-detection"

interface LeverPosting {
  id: string
  text: string
  hostedUrl: string
  createdAt: number
  descriptionPlain: string | null
  categories: {
    location?: string
    team?: string
    commitment?: string
  }
  tags: string[]
}

export async function fetchLeverJobs(companySlug: string, companyName: string): Promise<PersistedJobInput[]> {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(companySlug)}?mode=json`
  const res = await fetch(url, {
    headers: { "User-Agent": "Jobclock/1.0" },
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`Lever API error for company "${companySlug}": ${res.status}`)
  }

  const data = (await res.json()) as LeverPosting[]

  return data.map((posting) => {
    const location = posting.categories?.location ?? null
    const description = posting.descriptionPlain ?? null
    const { isRemote, remoteType } = detectRemoteType(posting.text, location, description)

    // Lever tags sometimes include "Remote"
    const isRemoteFinal = isRemote || (posting.tags ?? []).some((t) => /remote/i.test(t))

    return {
      url: posting.hostedUrl,
      source: "lever",
      title: posting.text,
      company: companyName,
      location,
      description,
      postedAt: posting.createdAt ? new Date(posting.createdAt).toISOString() : null,
      salaryCurrency: "GBP",
      isEasyApply: false,
      isRemote: isRemoteFinal,
      remoteType: isRemoteFinal && !remoteType ? "remote" : remoteType,
    } satisfies PersistedJobInput
  })
}
