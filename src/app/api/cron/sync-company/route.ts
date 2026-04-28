import { verifyCronRequest } from "@/lib/cron/verify-cron-request"
import { syncTrackedCompany } from "@/lib/jobs/ats/sync"

// Called by QStash for each individual company sync (fanned out from sync-companies).
export async function POST(request: Request) {
  const body = await verifyCronRequest(request)
  if (body === null) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { companyId, userId, userEmail } = JSON.parse(body) as {
    companyId: string
    userId: string
    userEmail: string
  }

  if (!companyId || !userId) {
    return Response.json({ error: "Missing companyId or userId" }, { status: 400 })
  }

  try {
    const result = await syncTrackedCompany(companyId, userId, userEmail ?? "")
    return Response.json({ ok: true, result })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
