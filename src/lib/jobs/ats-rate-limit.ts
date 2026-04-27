import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// 10 sync requests per minute per ATS type (shared across all users for a given ATS)
const atsRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  analytics: false,
  prefix: "ratelimit:ats-sync",
})

export async function checkAtsRateLimit(atsType: string): Promise<{ allowed: boolean; reset: number }> {
  const { success, reset } = await atsRateLimit.limit(atsType)
  return { allowed: success, reset }
}
