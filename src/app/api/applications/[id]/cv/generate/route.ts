import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { enqueueGeneration } from "@/lib/generation/enqueue"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await enqueueGeneration({ kind: "cv_tailor", userId: user.id, applicationId })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 429 })
  }
  return NextResponse.json({ jobId: result.jobId, deduped: result.deduped }, { status: 202 })
}
