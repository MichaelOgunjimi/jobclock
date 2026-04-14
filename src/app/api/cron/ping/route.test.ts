import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: vi.fn() },
}))

import { Redis } from "@upstash/redis"
import { NextRequest } from "next/server"
import { GET } from "./route"

describe("GET /api/cron/ping", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("CRON_SECRET", "test-secret")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 401 without auth header", async () => {
    const request = new NextRequest("http://localhost/api/cron/ping")

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("returns 401 with wrong bearer token", async () => {
    const request = new NextRequest("http://localhost/api/cron/ping", {
      headers: { authorization: "Bearer wrong-secret" },
    })

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body).toEqual({ error: "Unauthorized" })
  })

  it("returns 200 with correct bearer token and calls Redis set", async () => {
    const redisSet = vi.fn().mockResolvedValue("OK")
    vi.mocked(Redis.fromEnv).mockReturnValue({ set: redisSet } as never)
    const request = new NextRequest("http://localhost/api/cron/ping", {
      headers: { authorization: "Bearer test-secret" },
    })

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(typeof body.ts).toBe("string")
    expect(Redis.fromEnv).toHaveBeenCalledOnce()
    expect(redisSet).toHaveBeenCalledOnce()
    expect(redisSet).toHaveBeenCalledWith(
      "keepalive:cron",
      expect.any(String),
      { ex: 60 * 60 * 24 * 30 }
    )

    const [, payload] = redisSet.mock.calls[0]
    expect(JSON.parse(payload as string)).toEqual({
      ts: body.ts,
      source: "vercel-cron",
      purpose: "upstash-keepalive",
    })
  })

  it("returns 500 when Redis throws", async () => {
    const redisSet = vi.fn().mockRejectedValue(new Error("redis failed"))
    vi.mocked(Redis.fromEnv).mockReturnValue({ set: redisSet } as never)
    const request = new NextRequest("http://localhost/api/cron/ping", {
      headers: { authorization: "Bearer test-secret" },
    })

    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: "redis failed" })
  })
})
