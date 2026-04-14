import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Sliding window: 20 requests per 60 seconds per user
export const chatRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "60 s"),
  analytics: true,
  prefix: "ratelimit:chat",
})

// CV generation: 5 requests per 60 seconds per user
export const cvGenerateRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  analytics: true,
  prefix: "ratelimit:cv-generate",
})

// Cover letter and interview prep generation: 10 requests per 60 seconds per user
export const aiGenerateRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  analytics: true,
  prefix: "ratelimit:ai-generate",
})
