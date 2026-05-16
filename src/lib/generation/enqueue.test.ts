import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/rate-limit", () => ({
  aiGenerateRateLimit: { limit: vi.fn() },
}))
vi.mock("./jobs", () => ({
  createGenerationJob: vi.fn(),
}))
const { publishJSON } = vi.hoisted(() => ({ publishJSON: vi.fn() }))
vi.mock("@upstash/qstash", () => ({
  Client: class {
    publishJSON = publishJSON
  },
}))

vi.mock("./dispatch", () => ({ runJob: vi.fn() }))

import { aiGenerateRateLimit } from "@/lib/rate-limit"
import { createGenerationJob } from "./jobs"
import { runJob } from "./dispatch"
import { enqueueGeneration } from "./enqueue"

describe("enqueueGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns an error and creates no job when the user is rate-limited", async () => {
    vi.mocked(aiGenerateRateLimit.limit).mockResolvedValue({ success: false } as never)

    const result = await enqueueGeneration({
      userId: "user-1",
      kind: "cover_letter",
      applicationId: "app-1",
    })

    expect(result).toMatchObject({ error: expect.any(String) })
    expect(createGenerationJob).not.toHaveBeenCalled()
  })

  it("returns the existing job without publishing when deduped", async () => {
    vi.mocked(aiGenerateRateLimit.limit).mockResolvedValue({ success: true } as never)
    vi.mocked(createGenerationJob).mockResolvedValue({
      job: { id: "job-existing" } as never,
      deduped: true,
    })

    const result = await enqueueGeneration({
      userId: "user-1",
      kind: "cover_letter",
      applicationId: "app-1",
    })

    expect(result).toEqual({ jobId: "job-existing", deduped: true })
    expect(publishJSON).not.toHaveBeenCalled()
  })

  it("publishes a QStash job to the dispatcher on the happy path", async () => {
    process.env.QSTASH_TOKEN = "qstash-test-token"
    vi.mocked(aiGenerateRateLimit.limit).mockResolvedValue({ success: true } as never)
    vi.mocked(createGenerationJob).mockResolvedValue({
      job: { id: "job-new" } as never,
      deduped: false,
    })

    const result = await enqueueGeneration({
      userId: "user-1",
      kind: "interview_prep",
      applicationId: "app-1",
    })

    expect(result).toEqual({ jobId: "job-new", deduped: false })
    expect(publishJSON).toHaveBeenCalledTimes(1)
    const arg = publishJSON.mock.calls[0][0]
    expect(arg.url).toContain("/api/generate")
    expect(arg.body).toMatchObject({ jobId: "job-new" })
    delete process.env.QSTASH_TOKEN
  })

  it("inline-dispatches (no publish) when QSTASH_TOKEN is unset", async () => {
    delete process.env.QSTASH_TOKEN
    vi.mocked(aiGenerateRateLimit.limit).mockResolvedValue({ success: true } as never)
    vi.mocked(createGenerationJob).mockResolvedValue({
      job: { id: "job-inline" } as never,
      deduped: false,
    })

    const result = await enqueueGeneration({
      userId: "user-1",
      kind: "cover_letter",
      applicationId: "app-1",
    })

    expect(result).toEqual({ jobId: "job-inline", deduped: false })
    expect(publishJSON).not.toHaveBeenCalled()
    expect(runJob).toHaveBeenCalledWith("job-inline")
  })
})
