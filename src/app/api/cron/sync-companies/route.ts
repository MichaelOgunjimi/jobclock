import { NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { syncAllTrackedCompanies } from "@/lib/jobs/ats/sync"

// Runs every 2 hours via Vercel cron (vercel.json).
// Syncs all tracked companies for every user who has at least one enabled company.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get all distinct user IDs that have profiles (i.e. real users)
  const users = await db.select({ id: profiles.id }).from(profiles)

  const summary: Array<{ userId: string; synced: number; companies: number; errors: string[] }> = []

  for (const user of users) {
    try {
      const results = await syncAllTrackedCompanies(user.id)
      if (results.length === 0) continue
      summary.push({
        userId: user.id,
        companies: results.length,
        synced: results.reduce((acc, r) => acc + r.synced, 0),
        errors: results.flatMap((r) => r.errors),
      })
    } catch (err) {
      summary.push({
        userId: user.id,
        companies: 0,
        synced: 0,
        errors: [err instanceof Error ? err.message : String(err)],
      })
    }
  }

  const totalSynced = summary.reduce((acc, s) => acc + s.synced, 0)
  console.log(`[cron/sync-companies] synced ${totalSynced} jobs across ${summary.length} users`)

  return Response.json({ ok: true, users: summary.length, totalSynced, summary })
}
