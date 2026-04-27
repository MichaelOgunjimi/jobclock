import type { Job } from "./types"

const ATS_SOURCES = new Set(["greenhouse", "lever", "ashby"])

const SENIORITY_PATTERN =
  /\b(senior|sr\.?|junior|jr\.?|lead|principal|staff|associate|mid[- ]?level|entry[- ]?level|intern|graduate|grad)\b/gi

const NOISE_PATTERN = /[^a-z0-9\s]/g

function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(SENIORITY_PATTERN, "")
    .replace(NOISE_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function deduplicationKey(job: Job): string {
  const company = job.company.toLowerCase().trim()
  const title = normaliseTitle(job.title)
  return `${company}::${title}`
}

export function deduplicateJobs(jobs: Job[]): Job[] {
  const seen = new Map<string, Job>()

  for (const job of jobs) {
    const key = deduplicationKey(job)
    const existing = seen.get(key)

    if (!existing) {
      seen.set(key, job)
      continue
    }

    const jobIsAts = ATS_SOURCES.has(job.source)
    const existingIsAts = ATS_SOURCES.has(existing.source)

    if (jobIsAts && !existingIsAts) {
      seen.set(key, job)
    }
  }

  // Return in original insertion order, filtering to only kept entries
  const kept = new Set(seen.values())
  return jobs.filter((j) => kept.has(j))
}
