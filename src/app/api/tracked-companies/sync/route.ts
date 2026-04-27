import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { syncAllTrackedCompanies } from "@/lib/jobs/ats/sync"

export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const results = await syncAllTrackedCompanies(user.id, user.email ?? "")
    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0)
    return NextResponse.json({ synced: totalSynced, companies: results })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    )
  }
}
