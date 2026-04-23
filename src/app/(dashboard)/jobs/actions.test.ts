import { beforeEach, describe, expect, it, vi } from "vitest"
import { createMockSupabaseClient } from "@/test/supabase-mock"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: vi.fn() }))
vi.mock("@/lib/jobs/persist-job", () => ({ persistJobForUser: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { persistJobForUser } from "@/lib/jobs/persist-job"
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

  it("handles helper failure and duplicate application", async () => {
    vi.mocked(persistJobForUser).mockRejectedValueOnce(new Error("insert failed"))
    expect(await saveJob(sampleJob as never)).toEqual({ error: "Failed to save job" })

    vi.mocked(persistJobForUser).mockResolvedValueOnce({
      applicationId: "app-1",
      alreadySaved: true,
    })
    expect(await saveJob(sampleJob as never)).toEqual({ alreadySaved: true })
  })

  it("delegates to the shared persistence helper", async () => {
    vi.mocked(persistJobForUser).mockResolvedValueOnce({
      applicationId: "app-2",
      alreadySaved: false,
    })
    expect(await saveJob(sampleJob as never)).toEqual({ success: true })

    expect(persistJobForUser).toHaveBeenCalledWith("test-user-id", {
      url: sampleJob.url,
      source: sampleJob.source,
      title: sampleJob.title,
      company: sampleJob.company,
      location: sampleJob.location,
      description: sampleJob.description,
      salaryMin: sampleJob.salaryMin,
      salaryMax: sampleJob.salaryMax,
      salaryCurrency: sampleJob.salaryCurrency,
      postedAt: sampleJob.postedAt,
      isEasyApply: sampleJob.isEasyApply,
      applyDeadline: undefined,
    })
  })
})
