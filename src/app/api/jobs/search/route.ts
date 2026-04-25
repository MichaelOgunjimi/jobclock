import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { searchAdzunaJobs } from "@/lib/jobs/adzuna"
import { searchReedJobs } from "@/lib/jobs/reed"
import { searchCareerjetJobs } from "@/lib/jobs/careerjet"
import { decrypt } from "@/lib/crypto"
import { db } from "@/lib/db"
import { jobsCache } from "@/lib/db/schema"
import { and, or, ilike, inArray, eq, desc } from "drizzle-orm"
import type { Job } from "@/lib/jobs/types"
import type { UserPreferences } from "@/lib/ai"

const ATS_SOURCES = ["greenhouse", "lever", "ashby", "workday"]

async function searchTrackedJobs(query: string | undefined, location: string | undefined, perPage: number, page: number): Promise<{ jobs: Job[]; total: number; page: number }> {
  const conditions = [inArray(jobsCache.source, ATS_SOURCES)]

  if (query) {
    conditions.push(
      or(
        ilike(jobsCache.title, `%${query}%`),
        ilike(jobsCache.company, `%${query}%`)
      )!
    )
  }

  if (location) {
    conditions.push(
      or(
        ilike(jobsCache.location, `%${location}%`),
        eq(jobsCache.isRemote, true)
      )!
    )
  }

  const offset = (page - 1) * perPage

  const rows = await db
    .select()
    .from(jobsCache)
    .where(and(...conditions))
    .orderBy(desc(jobsCache.lastSeenAt))
    .limit(perPage)
    .offset(offset)

  const jobs: Job[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    company: r.company,
    location: r.location ?? null,
    description: r.description ?? null,
    salaryMin: r.salaryMin ? Number(r.salaryMin) : null,
    salaryMax: r.salaryMax ? Number(r.salaryMax) : null,
    salaryCurrency: r.salaryCurrency ?? "GBP",
    postedAt: r.postedAt?.toISOString() ?? null,
    url: r.url,
    source: r.source,
    isEasyApply: r.isEasyApply ?? null,
    lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
    isRemote: r.isRemote ?? null,
    remoteType: r.remoteType ?? null,
  }))

  return { jobs, total: jobs.length, page: 1 }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const searchParams = request.nextUrl.searchParams

  const query = searchParams.get("q") ?? undefined
  const location = searchParams.get("location") ?? undefined
  const salaryMin = searchParams.get("salary_min")
  const page = searchParams.get("page")
  const perPage = searchParams.get("per_page")
  const sortParam = searchParams.get("sort") as "relevance" | "date" | "salary" | null
  const sort = sortParam ?? "relevance"
  const experienceParam = searchParams.get("experience")
  const experienceLevels = experienceParam ? experienceParam.split(",").filter(Boolean) : []
  const sourcesParam = searchParams.get("sources")
  const sources = sourcesParam ? sourcesParam.split(",").filter(Boolean) : ["adzuna"]

  const pageNum = Math.max(1, parseInt(page ?? "") || 1)
  const perPageNum = Math.min(50, Math.max(1, parseInt(perPage ?? "") || 20))
  const salaryMinNum = salaryMin ? (parseInt(salaryMin) || undefined) : undefined

  const userIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1"
  const userAgent = request.headers.get("user-agent") ?? "Mozilla/5.0"

  // Map experience levels to synonyms used in what_or (Adzuna) and keyword appending (CareerJet)
  // Adzuna what_or: exact job-level phrases only — avoids matching "manage junior engineers" type noise.
  // These are phrases that would appear in a job title or posting *about* the role itself.
  const ADZUNA_WHAT_OR: Record<string, string[]> = {
    entry_level: ["entry level", "entry-level", "trainee", "apprentice"],
    graduate:    ["graduate", "new grad", "grad scheme"],
    junior:      ["junior", "jr."],
    mid:         ["mid-level", "intermediate", "mid level"],
    senior:      ["senior", "sr."],
    lead:        ["lead", "principal", "staff engineer", "head of engineering"],
  }

  // CareerJet keyword term per level (used in per-level parallel queries)
  const CAREERJET_TERM: Record<string, string> = {
    entry_level: "entry level",
    graduate:    "graduate",
    junior:      "junior",
    mid:         "mid level",
    senior:      "senior",
    lead:        "lead",
  }

  // Adzuna: when a role keyword exists, use what_or so experience is optional within results.
  // When no keyword, promote experience terms into what (required) so results aren't all-industry noise.
  const experiencePhrases = experienceLevels.length > 0
    ? [...new Set(experienceLevels.flatMap((l) => ADZUNA_WHAT_OR[l] ?? []))].join(" ")
    : undefined
  const adzunaQuery = query || (experiencePhrases ? experiencePhrases.split(" ")[0] : undefined)
  const adzunaWhatOr = query ? experiencePhrases : undefined

  const fetchers: Promise<{ jobs: Job[]; total: number; page: number }>[] = []

  if (sources.includes("adzuna")) {
    fetchers.push(
      searchAdzunaJobs({
        query: adzunaQuery,
        whatOr: adzunaWhatOr,
        location,
        salaryMin: salaryMinNum,
        page: pageNum,
        resultsPerPage: perPageNum,
        sort,
      })
    )
  }

  if (sources.includes("reed")) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferences")
        .eq("id", user.id)
        .single()

      const prefs = (profile?.preferences ?? {}) as UserPreferences
      const reedKeyRaw = prefs?.job_sources?.reed?.api_key
      const reedKey = reedKeyRaw ? decrypt(reedKeyRaw) : undefined

      if (reedKey) {
        fetchers.push(
          searchReedJobs({
            query,
            location,
            salaryMin: salaryMinNum,
            page: pageNum,
            resultsPerPage: perPageNum,
            apiKey: reedKey,
          })
        )
      }
    } catch (error) {
      console.error("Reed auth error:", error)
    }
  }

  if (sources.includes("tracked")) {
    fetchers.push(searchTrackedJobs(query, location, perPageNum, pageNum))
  }

  if (sources.includes("careerjet")) {
    const careerjetKey = process.env.CAREERJET_API_KEY
    if (careerjetKey) {
      // CareerJet has no what_or equivalent — AND-matches multi-word queries.
      // For multiple levels, fire one query per level and merge server-side.
      const careerjetLevels = experienceLevels.length > 0 ? experienceLevels : [null]
      const careerjetRequests = careerjetLevels.map((level) => {
        const term = level ? CAREERJET_TERM[level] : null
        // With keyword: append level term. Without keyword: use level term alone.
        const q = query
          ? (term ? `${query} ${term}` : query)
          : (term ?? query)
        return searchCareerjetJobs({
          query: q,
          location,
          page: pageNum,
          resultsPerPage: perPageNum,
          userIp,
          userAgent,
          apiKey: careerjetKey,
        })
      })

      fetchers.push(
        Promise.all(careerjetRequests).then((results) => {
          const seen = new Set<string>()
          const jobs: Job[] = []
          let total = 0
          for (const r of results) {
            total += r.total
            for (const j of r.jobs) {
              if (!seen.has(j.url)) { seen.add(j.url); jobs.push(j) }
            }
          }
          return { jobs, total, page: pageNum }
        })
      )
    }
  }

  try {
    const results = await Promise.allSettled(fetchers)

    const allJobs: Job[] = []
    let totalCount = 0

    for (const result of results) {
      if (result.status === "fulfilled") {
        allJobs.push(...result.value.jobs)
        totalCount += result.value.total
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>()
    let jobs = allJobs.filter((job) => {
      if (seen.has(job.url)) return false
      seen.add(job.url)
      return true
    })

    // Re-sort merged results — each source returns its own ordered slice so the
    // combined array interleaves them unsorted. Apply a global sort here so
    // "Most Recent" and "Salary" work across the full merged set.
    if (sort === "date") {
      jobs = jobs.sort((a, b) => {
        const ta = a.postedAt ? new Date(a.postedAt).getTime() : (a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0)
        const tb = b.postedAt ? new Date(b.postedAt).getTime() : (b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0)
        return tb - ta
      })

      // Drop listings older than 6 months when the caller wants recent results.
      // Adzuna and CareerJet both keep stale listings indefinitely; without this
      // old jobs fill the tail of every page even after a date sort.
      const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000
      jobs = jobs.filter(j => !j.postedAt || new Date(j.postedAt).getTime() >= cutoff)
    } else if (sort === "salary") {
      jobs = jobs.sort((a, b) => {
        const sa = a.salaryMax ?? a.salaryMin ?? 0
        const sb = b.salaryMax ?? b.salaryMin ?? 0
        return sb - sa
      })
    }

    return NextResponse.json({ jobs, total: jobs.length, page: pageNum, perPage: perPageNum })
  } catch (error) {
    console.error("Job search error:", error)
    return NextResponse.json({ error: "Failed to search jobs" }, { status: 500 })
  }
}
