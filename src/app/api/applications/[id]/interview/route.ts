import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { interviewPrep } from "@/lib/db/schema"
import { enqueueGeneration } from "@/lib/generation/enqueue"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const result = await enqueueGeneration({ kind: "interview_prep", userId: user.id, applicationId })
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 429 })
  }
  return NextResponse.json({ jobId: result.jobId, deduped: result.deduped }, { status: 202 })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify the application belongs to this user before returning saved prep
  const { data: appCheck } = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single()
  if (!appCheck) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [prep] = await db.select().from(interviewPrep).where(eq(interviewPrep.applicationId, applicationId)).limit(1)
  if (!prep) return NextResponse.json({ content: null, research: null, storyCount: null, questions: [], answers: {} })
  const saved = prep.suggestedAnswers as { raw?: string; storyCount?: number; answers?: Record<string, string> } | null
  const raw = saved?.raw ?? null
  const answers = (saved?.answers as Record<string, string> | undefined) ?? {}
  return NextResponse.json({ content: raw, research: prep.researchContent ?? null, questions: prep.questions ?? [], storyCount: saved?.storyCount ?? null, answers })
}
