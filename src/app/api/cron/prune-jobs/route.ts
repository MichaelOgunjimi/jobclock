import { NextRequest } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Delete jobs_cache entries older than 30 days that have no saved applications
    const result = await db.execute(sql`
      DELETE FROM jobs_cache
      WHERE last_seen_at < NOW() - INTERVAL '30 days'
        AND id NOT IN (
          SELECT DISTINCT job_id FROM applications WHERE job_id IS NOT NULL
        )
    `)

    const deleted = (result as { rowCount?: number }).rowCount ?? 0
    return Response.json({ ok: true, deleted })
  } catch (err) {
    console.error("[cron/prune-jobs] error:", err)
    return Response.json({ error: "Internal error" }, { status: 500 })
  }
}
