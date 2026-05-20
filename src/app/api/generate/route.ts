import "@/lib/generation/register"
import { verifyCronRequest } from "@/lib/cron/verify-cron-request"
import { runJob } from "@/lib/generation/dispatch"

// Cover-letter generation runs two sequential AI calls (company research +
// the letter itself), which routinely exceeds Vercel's default 60s ceiling
// and surfaces to the user as "request timeout". 300s covers the worst-case
// chain on Pro plans (max allowed is 300 on Pro, up to 800 on Enterprise).
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
