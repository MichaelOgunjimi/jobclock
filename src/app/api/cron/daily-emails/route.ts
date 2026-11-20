import { verifyCronRequest } from "@/lib/cron/verify-cron-request"
import { runDailyEmails } from "@/lib/email/daily-emails"

export const runtime = "nodejs"
export const maxDuration = 300

/** Daily cron (vercel.json): follow-up, deadline, interview, stale-application and credit emails. Each goes only to users who opted in. */
export async function POST(request: Request) {
  if ((await verifyCronRequest(request)) === null) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  return Response.json({ ok: true, ...(await runDailyEmails()) })
}

// Vercel Cron invokes scheduled routes with GET.
export const GET = POST
