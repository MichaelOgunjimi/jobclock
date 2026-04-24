import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications, storyBank, interviewPrep } from "@/lib/db/schema"
import { callPerplexity } from "@/lib/ai/perplexity"
import type { AppWithJob } from "@/lib/supabase/database.types"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: appData } = await supabase
    .from("applications")
    .select("*, jobs_cache (*)")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single()

  if (!appData) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  const app = appData as unknown as AppWithJob
  const description = app.custom_description ?? app.jobs_cache?.description ?? ""
  const title = app.jobs_cache?.title ?? "this role"
  const company = app.jobs_cache?.company ?? "this company"

  if (!description.trim()) {
    return NextResponse.json({ error: "No job description found for this application." }, { status: 422 })
  }

  // Fetch user's story bank
  const stories = await db
    .select()
    .from(storyBank)
    .where(eq(storyBank.userId, user.id))
    .orderBy(storyBank.createdAt)

  const storyBankText = stories.length > 0
    ? stories.map((s, i) =>
        `Story ${i + 1}: "${s.title}"\n` +
        `  Situation: ${s.situation ?? "—"}\n` +
        `  Task: ${s.task ?? "—"}\n` +
        `  Action: ${s.action ?? "—"}\n` +
        `  Result: ${s.result ?? "—"}\n` +
        `  Tags: ${(s.tags ?? []).join(", ") || "none"}`
      ).join("\n\n")
    : "No stories in the bank yet."

  const prompt = `You are an expert interview coach helping a candidate prepare for a ${title} role at ${company}.

Job Description:
${description.slice(0, 3000)}

The candidate's STAR story bank:
${storyBankText}

Generate a structured interview prep plan with exactly these sections:

1. PROCESS OVERVIEW
   - Typical rounds for this type of role (e.g. HR screen, technical, system design, behavioural panel, hiring manager)
   - What each round likely focuses on based on the JD
   - Approximate timeline

2. LIKELY INTERVIEW QUESTIONS (10-12 questions)
   For each: the question, which round it likely appears in, and which story from the bank best answers it (or "—" if none fits)
   Format: Q1. [question] | Round: [round] | Best story: [story title or —]

3. TECHNICAL PREP CHECKLIST
   - Key skills/tools from the JD the candidate must be ready to demonstrate
   - Any specific algorithms, frameworks, or concepts to review

4. RED FLAGS TO ADDRESS
   - Anything in the JD that suggests potential gaps; how to address them

5. QUESTIONS TO ASK THEM (5 good questions for the candidate to ask the interviewer)

Keep responses grounded in the actual JD. Label any inferred items as [inferred].`

  try {
    const content = await callPerplexity(
      [
        {
          role: "system",
          content: "You are an expert interview coach. Be specific and grounded in the job description provided. Do not hallucinate interview questions — only generate ones clearly suggested by the JD.",
        },
        { role: "user", content: prompt },
      ],
      { model: "sonar-pro", maxTokens: 3000 }
    )

    // Store in interview_prep table
    const existing = await db
      .select({ id: interviewPrep.id })
      .from(interviewPrep)
      .where(eq(interviewPrep.applicationId, applicationId))
      .limit(1)

    const questionsArray = content
      .split("\n")
      .filter((line) => /^Q\d+\./.test(line.trim()))
      .map((line) => line.trim())

    if (existing.length > 0) {
      await db
        .update(interviewPrep)
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
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Interview prep generation failed" },
      { status: 500 }
    )
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

  const [prep] = await db
    .select()
    .from(interviewPrep)
    .where(eq(interviewPrep.applicationId, applicationId))
    .limit(1)

  if (!prep) return NextResponse.json({ content: null })

  const raw = (prep.suggestedAnswers as { raw?: string } | null)?.raw ?? null
  return NextResponse.json({ content: raw, questions: prep.questions ?? [] })
}
