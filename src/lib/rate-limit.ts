import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Sliding window: 20 requests per 60 seconds per user
export const chatRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "60 s"),
  analytics: true,
  prefix: "ratelimit:chat",
})
