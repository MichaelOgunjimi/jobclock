import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

type RatelimitResponse = Awaited<ReturnType<Ratelimit["limit"]>>

const hasRedis = () => Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)

/**
 * Sliding window of `max` requests per 60 seconds.
 * - Local (APP_ENV=local) without Upstash: everything is allowed, so dev and tests need no Redis.
 * - Anywhere else without Upstash: throws, so a missing config can never silently switch limits off.
 * - `failOpen`: if Redis errors at runtime, let the request through instead of failing it. Use it only
 *   where blocking the user costs more than the abuse the limit prevents (billing), never for AI calls.
 */
export function createLimiter(prefix: string, max: number, { failOpen = false } = {}) {
  const allowed: RatelimitResponse = { success: true, limit: max, remaining: max, reset: 0, pending: Promise.resolve() }
  let real: Ratelimit | undefined

  return {
    async limit(identifier: string): Promise<RatelimitResponse> {
      if (!hasRedis()) {
        if (process.env.APP_ENV === "local") return allowed
        throw new Error("Rate limiting needs UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN unless APP_ENV=local")
      }
      real ??= new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(max, "60 s"),
        analytics: true,
        prefix,
      })
      try {
        return await real.limit(identifier)
      } catch (error) {
        if (!failOpen) throw error
        console.error(`[rate-limit] ${prefix} unavailable, allowing the request`, error)
        return allowed
      }
    },
  }
}

// 20 requests per 60 seconds per user
export const chatRateLimit = createLimiter("ratelimit:chat", 20)

// CV generation: 5 requests per 60 seconds per user
export const cvGenerateRateLimit = createLimiter("ratelimit:cv-generate", 5)

// Cover letter and interview prep generation: 10 requests per 60 seconds per user
export const aiGenerateRateLimit = createLimiter("ratelimit:ai-generate", 10)

// Billing routes (checkout, portal, resume, credits): a Redis outage must not stop someone paying.
export const billingRateLimit = createLimiter("ratelimit:billing", 10, { failOpen: true })
