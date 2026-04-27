import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { verifyCronRequest } from "@/lib/cron/verify-cron-request"
import { syncAllTrackedCompanies } from "@/lib/jobs/ats/sync"

// Triggered every 2 hours by QStash (POST).
// Syncs all tracked companies for every user who has at least one enabled company.
export async function POST(request: Request) {
  const body = await verifyCronRequest(request)
  if (body === null) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

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
