import type { Job } from "./types"

const CAREERJET_API_URL = "https://search.api.careerjet.net/v4/query"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobclock.michaelogunjimi.com"

interface CareerjetJob {
  title: string
  company: string
  date: string
  description: string
  locations: string
  salary: string
  salary_currency_code: string
  salary_max: number | null
  salary_min: number | null
  url: string
}

interface CareerjetResponse {
  type: "JOBS" | "LOCATIONS"
  hits?: number
  pages?: number
  jobs?: CareerjetJob[]
  message: string
}

export async function searchCareerjetJobs(params: {
  query?: string
  location?: string
  page?: number
  resultsPerPage?: number
  userIp: string
  userAgent: string
  apiKey: string
}): Promise<{ jobs: Job[]; total: number; page: number }> {
  const page = params.page ?? 1
  const perPage = params.resultsPerPage ?? 20

  const url = new URL(CAREERJET_API_URL)
  url.searchParams.set("locale_code", "en_GB")
  url.searchParams.set("user_ip", params.userIp)
  url.searchParams.set("user_agent", params.userAgent)
  url.searchParams.set("page", String(page))
  url.searchParams.set("page_size", String(perPage))
  url.searchParams.set("sort", "relevance")
  if (params.query) url.searchParams.set("keywords", params.query)
  if (params.location) url.searchParams.set("location", params.location)

  const credentials = Buffer.from(`${params.apiKey}:`).toString("base64")

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      Referer: APP_URL,
    },
    next: { revalidate: 300 },
  })

  if (!response.ok) {
    console.error("Careerjet API error:", response.status, await response.text())
    return { jobs: [], total: 0, page }
  }

  const data: CareerjetResponse = await response.json()

  if (data.type !== "JOBS" || !data.jobs) {
    return { jobs: [], total: 0, page }
  }

  const jobs: Job[] = data.jobs.map((job, i) => ({
    id: `careerjet-${Buffer.from(job.url).toString("base64").slice(0, 12)}`,
    title: job.title,
    company: job.company ?? "Unknown",
    location: job.locations ?? null,
    description: job.description ?? null,
    salaryMin: job.salary_min ?? null,
    salaryMax: job.salary_max ?? null,
    salaryCurrency: job.salary_currency_code ?? "GBP",
    postedAt: job.date ?? null,
    url: job.url,
    source: "careerjet",
    isEasyApply: false,
  }))

  return { jobs, total: data.hits ?? 0, page }
}
