import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { reconcileSubscriptions } = vi.hoisted(() => ({ reconcileSubscriptions: vi.fn() }))
vi.mock("@/lib/billing/reconcile", () => ({ reconcileSubscriptions }))

import { NextRequest } from "next/server"
import { GET } from "./route"

const request = (token?: string) =>
  new NextRequest("http://localhost/api/cron/reconcile-billing", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

describe("GET /api/cron/reconcile-billing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("CRON_SECRET", "test-secret")
  })
  afterEach(() => vi.unstubAllEnvs())

  it("rejects missing or wrong bearer tokens", async () => {
    expect((await GET(request())).status).toBe(401)
    expect((await GET(request("wrong"))).status).toBe(401)
    expect(reconcileSubscriptions).not.toHaveBeenCalled()
  })

  it("returns the reconciliation counts", async () => {
    reconcileSubscriptions.mockResolvedValue({ checked: 3, failed: 1, errors: ["sub_x: boom"] })
    const response = await GET(request("test-secret"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ checked: 3, failed: 1, errors: ["sub_x: boom"] })
  })

  it("returns 500 when reconciliation throws", async () => {
    reconcileSubscriptions.mockRejectedValue(new Error("db down"))
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect((await GET(request("test-secret"))).status).toBe(500)
  })
})
