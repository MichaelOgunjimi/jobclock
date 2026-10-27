import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { limitMock, ratelimitCtor } = vi.hoisted(() => {
  const limitMock = vi.fn()
  const ratelimitCtor = vi.fn(function () {
    return { limit: limitMock }
  })
  return { limitMock, ratelimitCtor }
})

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(ratelimitCtor, { slidingWindow: vi.fn(() => "window") }),
}))
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: vi.fn(() => ({})) } }))

import { createLimiter } from "./rate-limit"

describe("createLimiter", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "")
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "")
    limitMock.mockReset()
    ratelimitCtor.mockClear()
  })
  afterEach(() => vi.unstubAllEnvs())

  it("allows everything locally without Redis, never touching Upstash", async () => {
    vi.stubEnv("APP_ENV", "local")
    const result = await createLimiter("t", 5).limit("user")
    expect(result.success).toBe(true)
    expect(ratelimitCtor).not.toHaveBeenCalled()
  })

  it.each(["staging", "production", ""])("throws without Redis when APP_ENV is %j", async (appEnv) => {
    vi.stubEnv("APP_ENV", appEnv)
    await expect(createLimiter("t", 5, { failOpen: true }).limit("user")).rejects.toThrow(/UPSTASH_REDIS_REST_URL/)
  })

  describe("with Redis configured", () => {
    beforeEach(() => {
      vi.stubEnv("APP_ENV", "production")
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io")
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token")
    })

    it("passes the real limiter's answer through", async () => {
      limitMock.mockResolvedValue({ success: false })
      expect((await createLimiter("t", 5).limit("user")).success).toBe(false)
    })

    it("rethrows Redis errors by default", async () => {
      limitMock.mockRejectedValue(new Error("redis down"))
      await expect(createLimiter("t", 5).limit("user")).rejects.toThrow("redis down")
    })

    it("lets the request through on a Redis error when failOpen", async () => {
      limitMock.mockRejectedValue(new Error("redis down"))
      vi.spyOn(console, "error").mockImplementation(() => {})
      expect((await createLimiter("t", 5, { failOpen: true }).limit("user")).success).toBe(true)
    })
  })
})
