import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { searchAdzunaJobs } from "@/lib/jobs/adzuna"
import { searchReedJobs } from "@/lib/jobs/reed"
import type { Job } from "@/lib/jobs/types"
import type { UserPreferences } from "@/lib/ai"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const query = searchParams.get("q") ?? undefined
  const location = searchParams.get("location") ?? undefined
  const salaryMin = searchParams.get("salary_min")
  const page = searchParams.get("page")
  const sourcesParam = searchParams.get("sources")
  const sources = sourcesParam ? sourcesParam.split(",").filter(Boolean) : ["adzuna"]

  const pageNum = page ? parseInt(page) : 1
  const salaryMinNum = salaryMin ? parseInt(salaryMin) : undefined

  const fetchers: Promise<{ jobs: Job[]; total: number; page: number }>[] = []

  if (sources.includes("adzuna")) {
    fetchers.push(
      searchAdzunaJobs({
        query,
        location,
        salaryMin: salaryMinNum,
        page: pageNum,
        sort: "relevance",
      })
    )
  }

  if (sources.includes("reed")) {
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("preferences")
          .eq("id", user.id)
          .single()

        const prefs = (profile?.preferences ?? {}) as UserPreferences
        const reedKey = prefs?.job_sources?.reed?.api_key

        if (reedKey) {
          fetchers.push(
            searchReedJobs({
              query,
              location,
              salaryMin: salaryMinNum,
              page: pageNum,
              apiKey: reedKey,
            })
          )
        }
      }
    } catch (error) {
      console.error("Reed auth error:", error)
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
    const jobs = allJobs.filter((job) => {
      if (seen.has(job.url)) return false
      seen.add(job.url)
      return true
    })

    return NextResponse.json({ jobs, total: totalCount, page: pageNum })
  } catch (error) {
    console.error("Job search error:", error)
    return NextResponse.json({ error: "Failed to search jobs" }, { status: 500 })
  }
}
