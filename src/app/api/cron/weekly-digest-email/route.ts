import { verifyCronRequest } from "@/lib/cron/verify-cron-request"
import { sendWeeklyDigests } from "@/lib/email/weekly-digest"

export const runtime = "nodejs"
export const maxDuration = 300

/** Weekly cron (vercel.json): emails the digest to every user who turned on "Weekly digest". */
export async function POST(request: Request) {
  if ((await verifyCronRequest(request)) === null) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  return Response.json({ ok: true, ...(await sendWeeklyDigests()) })
}

// Vercel Cron invokes scheduled routes with GET.
export const GET = POST
