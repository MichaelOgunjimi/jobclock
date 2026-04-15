import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import type { Job } from "@/lib/jobs/types"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/jobs/adzuna", () => ({ searchAdzunaJobs: vi.fn() }))
vi.mock("@/lib/jobs/reed", () => ({ searchReedJobs: vi.fn() }))
vi.mock("@/lib/jobs/careerjet", () => ({ searchCareerjetJobs: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { searchAdzunaJobs } from "@/lib/jobs/adzuna"
import { searchReedJobs } from "@/lib/jobs/reed"
import { searchCareerjetJobs } from "@/lib/jobs/careerjet"
import { GET } from "./route"

function createSearchRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/jobs/search")
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url)
}

const mockJob = (id: string, overrides: Partial<Job> = {}): Job => ({
  id,
  title: "Software Engineer",
  company: "Acme",
  location: "London",
  description: "A job",
  salaryMin: 50000,
  salaryMax: 70000,
  salaryCurrency: "GBP",
  postedAt: "2026-01-01",
  url: `https://example.com/job-${id}`,
  source: "adzuna",
  isEasyApply: false,
  ...overrides,
})

describe("GET /api/jobs/search", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(searchAdzunaJobs).mockResolvedValue({ jobs: [], total: 0, page: 1 })
    vi.mocked(searchReedJobs).mockResolvedValue({ jobs: [], total: 0, page: 1 })
    vi.mocked(searchCareerjetJobs).mockResolvedValue({ jobs: [], total: 0, page: 1 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 401 when not authenticated", async () => {
    supabaseMock.setUser(null)

    const response = await GET(createSearchRequest())

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
  })

  it("calls Adzuna by default with correct params", async () => {
    await GET(createSearchRequest({ q: "engineer", location: "London", salary_min: "50000" }))

    expect(searchAdzunaJobs).toHaveBeenCalledTimes(1)
    expect(searchAdzunaJobs).toHaveBeenCalledWith({
      query: "engineer",
      whatOr: undefined,
      location: "London",
      salaryMin: 50000,
      page: 1,
      resultsPerPage: 20,
      sort: "relevance",
    })
    expect(searchReedJobs).not.toHaveBeenCalled()
    expect(searchCareerjetJobs).not.toHaveBeenCalled()
  })

  it("returns jobs from Adzuna search", async () => {
    vi.mocked(searchAdzunaJobs).mockResolvedValue({
      jobs: [mockJob("1")],
      total: 1,
      page: 1,
    })

    const response = await GET(createSearchRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({
      jobs: [mockJob("1")],
      total: 1,
      page: 1,
      perPage: 20,
    })
  })

  it("passes experience levels as what_or to Adzuna", async () => {
    await GET(createSearchRequest({ q: "software engineer", experience: "junior,graduate" }))

    expect(searchAdzunaJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "software engineer",
        whatOr: "junior jr. graduate new grad grad scheme",
      })
    )
  })

  it("skips Reed when user has no Reed API key", async () => {
    await GET(createSearchRequest({ sources: "reed", q: "engineer" }))

    expect(searchReedJobs).not.toHaveBeenCalled()
  })

  it("calls Reed when user has Reed API key in preferences", async () => {
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: { job_sources: { reed: { api_key: "reed-key-123" } } } },
    })

    await GET(
      createSearchRequest({
        sources: "reed",
        q: "engineer",
        location: "Manchester",
        salary_min: "45000",
        page: "2",
        per_page: "10",
      })
    )

    expect(searchReedJobs).toHaveBeenCalledTimes(1)
    expect(searchReedJobs).toHaveBeenCalledWith({
      query: "engineer",
      location: "Manchester",
      salaryMin: 45000,
      page: 2,
      resultsPerPage: 10,
      apiKey: "reed-key-123",
    })
  })

  it("skips CareerJet when CAREERJET_API_KEY env var is missing", async () => {
    await GET(createSearchRequest({ sources: "careerjet", q: "engineer" }))

    expect(searchCareerjetJobs).not.toHaveBeenCalled()
  })

  it("calls CareerJet when env var is present", async () => {
    vi.stubEnv("CAREERJET_API_KEY", "cj-key-123")

    await GET(createSearchRequest({ sources: "careerjet", q: "engineer", experience: "junior,senior" }))

    expect(searchCareerjetJobs).toHaveBeenCalledTimes(2)
    expect(searchCareerjetJobs).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        query: "engineer junior",
        apiKey: "cj-key-123",
      })
    )
    expect(searchCareerjetJobs).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        query: "engineer senior",
        apiKey: "cj-key-123",
      })
    )
  })

  it("deduplicates jobs by URL across sources", async () => {
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: { job_sources: { reed: { api_key: "reed-key-123" } } } },
    })

    const sharedUrl = "https://example.com/shared-job"
    vi.mocked(searchAdzunaJobs).mockResolvedValue({
      jobs: [mockJob("adzuna-1", { url: sharedUrl }), mockJob("adzuna-2")],
      total: 2,
      page: 1,
    })
    vi.mocked(searchReedJobs).mockResolvedValue({
      jobs: [mockJob("reed-1", { source: "reed", url: sharedUrl }), mockJob("reed-2", { source: "reed" })],
      total: 2,
      page: 1,
    })

    const response = await GET(createSearchRequest({ sources: "adzuna,reed" }))
    const body = await response.json()

    expect(body.jobs).toHaveLength(3)
    expect(new Set(body.jobs.map((job: Job) => job.url)).size).toBe(3)
    expect(body.total).toBe(4)
  })

  it("handles partial failures via Promise.allSettled", async () => {
    supabaseMock.setQueryResult("profiles.select.single", {
      data: { preferences: { job_sources: { reed: { api_key: "reed-key-123" } } } },
    })

    vi.mocked(searchAdzunaJobs).mockRejectedValue(new Error("Adzuna down"))
    vi.mocked(searchReedJobs).mockResolvedValue({
      jobs: [mockJob("reed-1", { source: "reed" })],
      total: 1,
      page: 1,
    })

    const response = await GET(createSearchRequest({ sources: "adzuna,reed" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.jobs).toEqual([mockJob("reed-1", { source: "reed" })])
    expect(body.total).toBe(1)
  })

  it("parses page/perPage params correctly (defaults, clamping)", async () => {
    await GET(createSearchRequest())
    expect(searchAdzunaJobs).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, resultsPerPage: 20 })
    )

    await GET(createSearchRequest({ page: "0", per_page: "999" }))
    expect(searchAdzunaJobs).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, resultsPerPage: 50 })
    )
  })

  it("returns empty results when all fetchers fail", async () => {
    vi.mocked(searchAdzunaJobs).mockRejectedValue(new Error("Adzuna failed"))

    const response = await GET(createSearchRequest({ sources: "adzuna" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.jobs).toEqual([])
    expect(body.total).toBe(0)
  })
})
