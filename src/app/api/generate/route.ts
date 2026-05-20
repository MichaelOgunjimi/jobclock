import "@/lib/generation/register"
import { verifyCronRequest } from "@/lib/cron/verify-cron-request"
import { runJob } from "@/lib/generation/dispatch"

// Web-search-backed generation (company research, cover letter) can take up
// to 90 s. Give the function 300 s so Vercel Pro never cuts it short.
export const maxDuration = 300

// Called by QStash to execute one enqueued generation job.
// Returns 5xx on failure so QStash retries.
export async function POST(request: Request) {
  const body = await verifyCronRequest(request)
  if (body === null) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { jobId } = JSON.parse(body) as { jobId?: string }
  if (!jobId) {
    return Response.json({ error: "Missing jobId" }, { status: 400 })
  }

  try {
    await runJob(jobId)
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
