import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { storyBank, interviewPrep } from "@/lib/db/schema"
import { resolveAiConfig, generateText, type UserPreferences } from "@/lib/ai"
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
  let settings: ReturnType<typeof resolveAiConfig>["settings"]
  let apiKey: string
  try {
    const resolved = resolveAiConfig(preferences)
    settings = resolved.settings
    apiKey = resolved.apiKey
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No AI API key configured." }, { status: 422 })
  }

  const stories = await db.select().from(storyBank).where(eq(storyBank.userId, user.id)).orderBy(storyBank.createdAt)

  const storyBankText = stories.length > 0
    ? stories.map((s, i) =>
        `Story ${i + 1}: "${s.title}"\n  Situation: ${s.situation ?? "—"}\n  Task: ${s.task ?? "—"}\n  Action: ${s.action ?? "—"}\n  Result: ${s.result ?? "—"}\n  Tags: ${(s.tags ?? []).join(", ") || "none"}`
      ).join("\n\n")
    : "No stories in the story bank yet."

  const systemPrompt = `You are an expert interview coach. Be specific and grounded in the actual job description provided. Never fabricate interview questions — only generate ones clearly suggested by the JD or standard for this role type.`

  const userPrompt = `Prepare a structured interview plan for the ${title} role at ${company}.

Job Description:
${description.slice(0, 3000)}

Candidate's STAR story bank:
${storyBankText}

Generate a plan with exactly these sections:

1. PROCESS OVERVIEW
   - Typical interview rounds for this type of role (e.g. HR screen, technical, system design, behavioural, hiring manager)
   - What each round likely focuses on, based on the JD
   - Approximate timeline if inferable

2. LIKELY QUESTIONS (10–12 questions)
   For each: the question, which round it appears in, and which story from the bank best answers it (or "—" if none fits).
   Format each as: Q1. [question] | Round: [round name] | Best story: [story title or —]

3. TECHNICAL PREP CHECKLIST
   - Key skills, tools, and frameworks from the JD the candidate must be ready to demonstrate
   - Any specific algorithms, architectures, or concepts to review

4. RED FLAGS TO ADDRESS
   - Anything in the JD that might suggest a gap; one sentence on how to handle each

5. QUESTIONS TO ASK THEM (5 strong questions for the candidate to ask)

Keep it grounded in the JD. Label anything inferred as [inferred].`

  try {
    const content = await generateText(settings, apiKey, systemPrompt, userPrompt, 3000)

    const questionsArray = content
      .split("\n")
      .filter((line) => /^Q\d+\./.test(line.trim()))
      .map((line) => line.trim())

    const existing = await db.select({ id: interviewPrep.id }).from(interviewPrep).where(eq(interviewPrep.applicationId, applicationId)).limit(1)

    if (existing.length > 0) {
      await db.update(interviewPrep).set({ questions: questionsArray, suggestedAnswers: { raw: content, storyCount: stories.length } }).where(eq(interviewPrep.applicationId, applicationId))
    } else {
      await db.insert(interviewPrep).values({ applicationId, questions: questionsArray, suggestedAnswers: { raw: content, storyCount: stories.length } })
    }

    return NextResponse.json({ content, questions: questionsArray, storyCount: stories.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Interview prep generation failed" }, { status: 500 })
  }
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
  if (!prep) return NextResponse.json({ content: null })
  const raw = (prep.suggestedAnswers as { raw?: string } | null)?.raw ?? null
  return NextResponse.json({ content: raw, questions: prep.questions ?? [] })
}
