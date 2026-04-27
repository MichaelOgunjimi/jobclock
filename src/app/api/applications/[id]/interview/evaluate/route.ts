import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAiConfig, generateText, type UserPreferences } from "@/lib/ai"
import type { AppWithJob } from "@/lib/supabase/database.types"
import { aiGenerateRateLimit } from "@/lib/rate-limit"

const MAX_QUESTION_LENGTH = 2_000
const MAX_ANSWER_LENGTH = 5_000

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { success: withinLimit } = await aiGenerateRateLimit.limit(user.id)
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      { status: 429 }
    )
  }

  const body = await req.json() as { question?: string; answer?: string }
  const question = body.question?.trim().slice(0, MAX_QUESTION_LENGTH)
  const answer = body.answer?.trim().slice(0, MAX_ANSWER_LENGTH)

  if (!question || !answer) {
    return NextResponse.json({ error: "question and answer are required" }, { status: 400 })
  }

  const [{ data: appData }, { data: profileData }] = await Promise.all([
    supabase.from("applications").select("*, jobs_cache (*)").eq("id", applicationId).eq("user_id", user.id).single(),
    supabase.from("profiles").select("preferences").eq("id", user.id).single(),
  ])

  if (!appData) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  const app = appData as unknown as AppWithJob
  const title = app.jobs_cache?.title ?? "this role"
  const company = app.jobs_cache?.company ?? "this company"
  const description = (app.custom_description ?? app.jobs_cache?.description ?? "").slice(0, 1500)

  const preferences = (profileData?.preferences ?? {}) as UserPreferences
  let settings: ReturnType<typeof resolveAiConfig>["settings"]
  let apiKey: string
  try {
    const resolved = resolveAiConfig(preferences)
    settings = resolved.settings
    apiKey = resolved.apiKey
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No AI API key configured" },
      { status: 422 }
    )
  }

  const systemPrompt = `You are a tough but fair interview coach. Be direct — if an answer is weak, say so clearly. If it's strong, acknowledge that too. Focus on what the candidate can act on immediately.`

  const userPrompt = `The candidate is practising for a **${title}** interview at **${company}**.

Job context (excerpt):
${description || "Not available."}

---

**Question asked:**
${question}

**Candidate's answer:**
${answer}

---

Evaluate the answer on these four dimensions and respond using exactly this markdown structure:

## What worked
- [specific things that were good — quote their words where relevant]

## What was missing
- [specific gaps — what a strong answer would have included]

## Structure check
Was the answer STAR-structured (Situation → Task → Action → Result)? If not, identify which parts were absent or underdeveloped. One short paragraph.

## Improved version (first 2–3 sentences only)
Rewrite just the opening of their answer to show how it could land better. Don't write a full answer — just enough to show the pattern they should follow.`

  try {
    const feedback = await generateText(settings, apiKey, systemPrompt, userPrompt, 1200)
    return NextResponse.json({ feedback })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Evaluation failed" }, { status: 500 })
  }
}
