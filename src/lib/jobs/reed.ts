import type { Job } from "./types"

const REED_BASE_URL = "https://www.reed.co.uk/api/1.0"

interface ReedJob {
  jobId: number
  employerId: number
  employerName: string
  jobTitle: string
  locationName: string
  minimumSalary: number | null
  maximumSalary: number | null
  currency: string | null
  expirationDate: string | null
  date: string
  jobDescription: string
  applications: number
  jobUrl: string
}

interface ReedResponse {
  results: ReedJob[]
  total: number
}

export async function searchReedJobs(params: {
  query?: string
  location?: string
  salaryMin?: number
  page?: number
  resultsPerPage?: number
  apiKey: string
}): Promise<{ jobs: Job[]; total: number; page: number }> {
  const perPage = params.resultsPerPage ?? 20
  const page = params.page ?? 1
  const skip = (page - 1) * perPage

  const url = new URL(`${REED_BASE_URL}/search`)
  if (params.query) url.searchParams.set("keywords", params.query)
  if (params.location) url.searchParams.set("location", params.location)
  if (params.salaryMin) url.searchParams.set("minimumSalary", String(params.salaryMin))
  url.searchParams.set("resultsToTake", String(perPage))
  url.searchParams.set("resultsToSkip", String(skip))

  const credentials = Buffer.from(`${params.apiKey}:`).toString("base64")

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 300 },
  })

  if (!response.ok) {
    console.error("Reed API error:", response.status, await response.text())
    return { jobs: [], total: 0, page }
  }

  const data: ReedResponse = await response.json()

  const jobs: Job[] = data.results.map((job) => ({
    id: `reed-${job.jobId}`,
    title: job.jobTitle,
    company: job.employerName,
    location: job.locationName ?? null,
    description: job.jobDescription ?? null,
    salaryMin: job.minimumSalary ?? null,
    salaryMax: job.maximumSalary ?? null,
    salaryCurrency: "GBP",
    postedAt: job.date ?? null,
    url: job.jobUrl,
    source: "reed",
    isEasyApply: false,
    applyDeadline: job.expirationDate ?? null,
  }))

  return { jobs, total: data.total, page }
}
