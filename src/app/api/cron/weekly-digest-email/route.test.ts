import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ verify: vi.fn(), send: vi.fn() }))
vi.mock("@/lib/cron/verify-cron-request", () => ({ verifyCronRequest: mocks.verify }))
vi.mock("@/lib/email/weekly-digest", () => ({ sendWeeklyDigests: mocks.send }))

import { GET, POST } from "./route"

describe("weekly digest email cron", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verify.mockResolvedValue("")
    mocks.send.mockResolvedValue({ eligible: 2, sent: 1, failed: 0 })
  })

  it("rejects unauthenticated requests", async () => {
    mocks.verify.mockResolvedValue(null)
    expect((await POST(new Request("http://x"))).status).toBe(401)
    expect((await GET(new Request("http://x"))).status).toBe(401)
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it("runs the digest for Vercel Cron (GET) and for manual or QStash calls (POST)", async () => {
    expect(await (await GET(new Request("http://x"))).json()).toEqual({ ok: true, eligible: 2, sent: 1, failed: 0 })
    expect((await POST(new Request("http://x", { method: "POST" }))).status).toBe(200)
  })
})
