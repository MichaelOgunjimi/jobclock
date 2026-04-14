import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { saveJob } from "./actions"

const sampleJob = {
  id: "job-1",
  url: "https://example.com/job-1",
  source: "adzuna",
  title: "Software Engineer",
  company: "Acme",
  location: "London",
  description: "Job description",
  salaryMin: 50000,
  salaryMax: 70000,
  salaryCurrency: "GBP",
  postedAt: "2026-01-01",
  isEasyApply: true,
}

describe("saveJob", () => {
  let supabaseMock: ReturnType<typeof createMockSupabaseClient>

  beforeEach(() => {
    vi.clearAllMocks()
    supabaseMock = createMockSupabaseClient()
    vi.mocked(createClient).mockResolvedValue(supabaseMock.client as never)
    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
  })

  it("returns config and auth errors", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    expect(await saveJob(sampleJob as never)).toEqual({
      error: "Supabase not configured",
    })

    vi.mocked(isSupabaseConfigured).mockReturnValue(true)
    supabaseMock.setUser(null)
    expect(await saveJob(sampleJob as never)).toEqual({ error: "Unauthorized" })
  })

  it("handles cache failure and duplicate application", async () => {
    supabaseMock.setQueryResult("jobs_cache.select.single", {
      error: { message: "upsert failed" },
      data: null,
    })
    expect(await saveJob(sampleJob as never)).toEqual({ error: "Failed to cache job" })

    supabaseMock.setQueryResult("jobs_cache.select.single", { data: { id: "cached-1" } })
    supabaseMock.setQueryResult("applications.select.maybeSingle", {
      data: { id: "app-1" },
    })
    expect(await saveJob(sampleJob as never)).toEqual({ alreadySaved: true })
  })

  it("handles insert errors and success", async () => {
    supabaseMock.setQueryResult("jobs_cache.select.single", { data: { id: "cached-1" } })
    supabaseMock.setQueryResult("applications.select.maybeSingle", { data: null })
    supabaseMock.setQueryResult("applications.insert", { error: { message: "insert failed" } })
    expect(await saveJob(sampleJob as never)).toEqual({ error: "Failed to save job" })

    supabaseMock.setQueryResult("applications.insert", { error: null })
    expect(await saveJob(sampleJob as never)).toEqual({ success: true })

    const upsertCall = supabaseMock
      .getQueryCalls()
      .find((call) => call.table === "jobs_cache")
    expect(upsertCall?.options).toEqual({ onConflict: "url" })

    const insertCall = supabaseMock
      .getQueryCalls()
      .find((call) => call.table === "applications" && call.operation === "insert")
    expect(insertCall?.payload).toEqual({
      user_id: "test-user-id",
      job_id: "cached-1",
      status: "saved",
    })
  })
})
