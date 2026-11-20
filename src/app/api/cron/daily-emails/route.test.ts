import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ verify: vi.fn(), run: vi.fn() }))
vi.mock("@/lib/cron/verify-cron-request", () => ({ verifyCronRequest: mocks.verify }))
vi.mock("@/lib/email/daily-emails", () => ({ runDailyEmails: mocks.run }))

import { GET, POST } from "./route"

describe("daily emails cron", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verify.mockResolvedValue("")
    mocks.run.mockResolvedValue({ followUps: { eligible: 1, sent: 1, failed: 0 } })
  })

  it("rejects unauthenticated requests", async () => {
    mocks.verify.mockResolvedValue(null)
    expect((await GET(new Request("http://x"))).status).toBe(401)
    expect((await POST(new Request("http://x", { method: "POST" }))).status).toBe(401)
    expect(mocks.run).not.toHaveBeenCalled()
  })

  it("runs the daily jobs and reports each result", async () => {
    expect(await (await GET(new Request("http://x"))).json()).toEqual({ ok: true, followUps: { eligible: 1, sent: 1, failed: 0 } })
  })
})
