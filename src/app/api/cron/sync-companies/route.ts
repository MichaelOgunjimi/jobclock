import { Client } from "@upstash/qstash"
import { db } from "@/lib/db"
import { trackedCompanies, profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { verifyCronRequest } from "@/lib/cron/verify-cron-request"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobclock.michaelogunjimi.com"

// Triggered every 2 hours by QStash (POST).
// Fans out one QStash message per enabled tracked company so each
// company syncs in its own short-lived invocation — avoids the
// Vercel 10 s timeout that occurs when syncing everything serially.
export async function POST(request: Request) {
  const body = await verifyCronRequest(request)
  if (body === null) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const qstashToken = process.env.QSTASH_TOKEN
  if (!qstashToken) {
    return Response.json({ error: "QSTASH_TOKEN not configured" }, { status: 500 })
  }

  const companies = await db
    .select({
      id: trackedCompanies.id,
      userId: trackedCompanies.userId,
      email: profiles.email,
    })
    .from(trackedCompanies)
    .innerJoin(profiles, eq(trackedCompanies.userId, profiles.id))
    .where(eq(trackedCompanies.enabled, true))

  if (companies.length === 0) {
    return Response.json({ ok: true, enqueued: 0 })
  }

  const client = new Client({ token: qstashToken })

  const results = await Promise.allSettled(
    companies.map((c) =>
      client.publishJSON({
        url: `${APP_URL}/api/cron/sync-company`,
        body: { companyId: c.id, userId: c.userId, userEmail: c.email },
      })
    )
  )

  const enqueued = results.filter((r) => r.status === "fulfilled").length
  const failed = results.length - enqueued

  console.log(`[cron/sync-companies] enqueued ${enqueued} company syncs (${failed} failed to enqueue)`)
  return Response.json({ ok: true, enqueued, failed })
}
