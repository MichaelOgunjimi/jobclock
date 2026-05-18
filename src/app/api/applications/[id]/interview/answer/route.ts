import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { enqueueGeneration } from "@/lib/generation/enqueue"

const MAX_QUESTION_LENGTH = 2_000

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as { questionText?: string }
  const questionText = body.questionText?.trim().slice(0, MAX_QUESTION_LENGTH)
  if (!questionText) {
    return NextResponse.json({ error: "questionText is required" }, { status: 400 })
  }

  const result = await enqueueGeneration({
    kind: "interview_answer",
    userId: user.id,
    applicationId,
    params: { questionText },
  })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 429 })
  }
  return NextResponse.json({ jobId: result.jobId, deduped: result.deduped }, { status: 202 })
}
