import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { storyBank, interviewPrep } from "@/lib/db/schema"
import { resolveAiConfig, generateText, type UserPreferences } from "@/lib/ai"
import { callPerplexity } from "@/lib/ai/perplexity"
import { decrypt } from "@/lib/crypto"
import { interviewSystemPrompt, interviewUserPrompt } from "@/lib/prompts/interview"
import type { AppWithJob } from "@/lib/supabase/database.types"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [{ data: appData }, { data: profileData }] = await Promise.all([
    supabase.from("applications").select("*, jobs_cache (*)").eq("id", applicationId).eq("user_id", user.id).single(),
    supabase.from("profiles").select("preferences").eq("id", user.id).single(),
  ])

  if (!appData) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  const app = appData as unknown as AppWithJob
  const description = app.custom_description ?? app.jobs_cache?.description ?? ""
  const title = app.jobs_cache?.title ?? "this role"
  const company = app.jobs_cache?.company ?? "this company"

  if (!description.trim()) {
    return NextResponse.json({ error: "No job description found for this application." }, { status: 422 })
  }

  const preferences = (profileData?.preferences ?? {}) as UserPreferences

  const stories = await db.select().from(storyBank).where(eq(storyBank.userId, user.id)).orderBy(storyBank.createdAt)

  const storyBankText = stories.length > 0
    ? stories.map((s, i) =>
        `Story ${i + 1}: "${s.title}"\n  Situation: ${s.situation ?? "—"}\n  Task: ${s.task ?? "—"}\n  Action: ${s.action ?? "—"}\n  Result: ${s.result ?? "—"}\n  Tags: ${(s.tags ?? []).join(", ") || "none"}`
      ).join("\n\n")
    : "No stories in the story bank yet."

  const systemPrompt = interviewSystemPrompt()
  const userPrompt = interviewUserPrompt({ title, company, description, storyBankText })

  let content: string
  try {
    const rawPerplexityKey = preferences.perplexity_api_key
    if (rawPerplexityKey) {
      const perplexityKey = decrypt(rawPerplexityKey)
      content = await callPerplexity(
        [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        { apiKey: perplexityKey, model: "sonar-pro", maxTokens: 3000 }
      )
    } else {
      const { settings, apiKey } = resolveAiConfig(preferences)
      content = await generateText(settings, apiKey, systemPrompt, userPrompt, 3000)
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Interview prep generation failed" }, { status: 500 })
  }

  const questionsArray = content
    .split("\n")
    .filter((line) => /^\*\*Q\d+\.\*\*|^Q\d+\./.test(line.trim()))
    .map((line) => line.trim())

  const existing = await db.select({ id: interviewPrep.id }).from(interviewPrep).where(eq(interviewPrep.applicationId, applicationId)).limit(1)

  if (existing.length > 0) {
    await db.update(interviewPrep)
      .set({ questions: questionsArray, suggestedAnswers: { raw: content, storyCount: stories.length } })
      .where(eq(interviewPrep.applicationId, applicationId))
  } else {
    await db.insert(interviewPrep).values({
      applicationId,
      questions: questionsArray,
      suggestedAnswers: { raw: content, storyCount: stories.length },
    })
  }

  return NextResponse.json({ content, questions: questionsArray, storyCount: stories.length })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [prep] = await db.select().from(interviewPrep).where(eq(interviewPrep.applicationId, applicationId)).limit(1)
  if (!prep) return NextResponse.json({ content: null, research: null, storyCount: null })
  const saved = prep.suggestedAnswers as { raw?: string; storyCount?: number } | null
  const raw = saved?.raw ?? null
  return NextResponse.json({ content: raw, research: prep.researchContent ?? null, questions: prep.questions ?? [], storyCount: saved?.storyCount ?? null })
}
