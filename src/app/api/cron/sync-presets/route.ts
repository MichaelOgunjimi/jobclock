import { NextRequest, NextResponse } from "next/server"
import { syncPresetCompanies } from "@/lib/jobs/sync-preset-companies"

// Called by Vercel Cron (see vercel.json) or manually with the secret header.
// POST /api/cron/sync-presets
// Header: Authorization: Bearer <CRON_SECRET>
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get("authorization")
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const results = await syncPresetCompanies({ concurrency: 5 })
    const synced = results.reduce((n, r) => n + r.synced, 0)
    const skipped = results.filter(r => r.skipped).length
    const errors = results.filter(r => r.error).map(r => `${r.company}: ${r.error}`)

    return NextResponse.json({ synced, skipped, errors, companies: results.length })
  } catch (err) {
    console.error("Preset sync failed:", err)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}

// Vercel Cron also supports GET for scheduled invocations
export async function GET(request: NextRequest) {
  return POST(request)
}
