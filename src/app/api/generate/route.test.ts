import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/cron/verify-cron-request", () => ({ verifyCronRequest: vi.fn() }))
vi.mock("@/lib/generation/dispatch", () => ({ runJob: vi.fn() }))

import { verifyCronRequest } from "@/lib/cron/verify-cron-request"
import { runJob } from "@/lib/generation/dispatch"
import { POST } from "./route"

function req(): Request {
  return new Request("https://app.test/api/generate", { method: "POST" })
}

describe("POST /api/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 and does not run the job when the signature is invalid", async () => {
    vi.mocked(verifyCronRequest).mockResolvedValue(null)

    const res = await POST(req())

    expect(res.status).toBe(401)
    expect(runJob).not.toHaveBeenCalled()
  })

  it("runs the job and returns 200 on a valid signed request", async () => {
    vi.mocked(verifyCronRequest).mockResolvedValue(JSON.stringify({ jobId: "job-1" }))
    vi.mocked(runJob).mockResolvedValue(undefined)

    const res = await POST(req())

    expect(runJob).toHaveBeenCalledWith("job-1")
    expect(res.status).toBe(200)
  })

  it("returns 500 when the job fails so QStash retries", async () => {
    vi.mocked(verifyCronRequest).mockResolvedValue(JSON.stringify({ jobId: "job-1" }))
    vi.mocked(runJob).mockRejectedValue(new Error("boom"))

    const res = await POST(req())

    expect(res.status).toBe(500)
  })
})
