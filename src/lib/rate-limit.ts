import { Ratelimit } from "@upstash/ratelimit"
import { MCP_AUTH_FAILURES_PER_MINUTE, MCP_GENERATIONS_PER_MINUTE, MCP_REQUESTS_PER_MINUTE, OAUTH_REGISTRATIONS_PER_MINUTE, OAUTH_TOKEN_REQUESTS_PER_MINUTE } from "@/lib/mcp/limits"
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

// Signup confirmation code: checking is keyed per client IP and per email (the six digits are the only secret, so guessing
// across IPs must stall too); resending sends an email, so it is tighter.
export const authCodeVerifyLimit = createLimiter("ratelimit:auth-code-verify", 10)
export const authCodeResendLimit = createLimiter("ratelimit:auth-code-resend", 3)

// MCP limits and the reason for each live in src/lib/mcp/limits.ts.
// MCP endpoint: per user (keyed by the token's owner, so extra tokens do not add headroom).
export const mcpRateLimit = createLimiter("ratelimit:mcp", MCP_REQUESTS_PER_MINUTE)

// AI generation started through MCP (ai:generate): per connection (token or connected app), on top of the web limit that enqueueGeneration applies per user.
export const mcpGenerationLimit = createLimiter("ratelimit:mcp-generate", MCP_GENERATIONS_PER_MINUTE)

// Failed MCP authentication, per client IP, to blunt token guessing and DB hammering.
export const mcpAuthFailureLimit = createLimiter("ratelimit:mcp-auth-failure", MCP_AUTH_FAILURES_PER_MINUTE)

// OAuth dynamic client registration, per client IP (each one writes a row).
export const oauthRegisterLimit = createLimiter("ratelimit:oauth-register", OAUTH_REGISTRATIONS_PER_MINUTE)

// OAuth token and revocation endpoints, per client IP, to blunt code and refresh-token guessing.
export const oauthTokenLimit = createLimiter("ratelimit:oauth-token", OAUTH_TOKEN_REQUESTS_PER_MINUTE)
