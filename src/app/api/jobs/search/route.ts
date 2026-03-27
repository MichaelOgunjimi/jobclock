import { NextRequest, NextResponse } from "next/server"
import { searchAdzunaJobs } from "@/lib/jobs/adzuna"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const query = searchParams.get("q") ?? undefined
  const location = searchParams.get("location") ?? undefined
  const salaryMin = searchParams.get("salary_min")
  const salaryMax = searchParams.get("salary_max")
  const distance = searchParams.get("distance")
  const page = searchParams.get("page")
  const sort = searchParams.get("sort") as "relevance" | "date" | "salary" | null

  try {
    const result = await searchAdzunaJobs({
      query,
      location,
      salaryMin: salaryMin ? parseInt(salaryMin) : undefined,
      salaryMax: salaryMax ? parseInt(salaryMax) : undefined,
      distance: distance ? parseInt(distance) : undefined,
      page: page ? parseInt(page) : 1,
      sort: sort ?? "relevance",
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Job search error:", error)
    return NextResponse.json(
      { error: "Failed to search jobs" },
      { status: 500 }
    )
  }
}
