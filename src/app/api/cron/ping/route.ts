import { NextRequest } from "next/server"
import { Redis } from "@upstash/redis"

const HEARTBEAT_KEY = "keepalive:cron"
const HEARTBEAT_TTL_SECONDS = 60 * 60 * 24 * 30

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const redis = Redis.fromEnv()
    const ts = new Date().toISOString()
    await redis.set(
      HEARTBEAT_KEY,
      JSON.stringify({
        ts,
        source: "vercel-cron",
        purpose: "upstash-keepalive",
      }),
      { ex: HEARTBEAT_TTL_SECONDS }
    )
    return Response.json({ ok: true, ts })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
