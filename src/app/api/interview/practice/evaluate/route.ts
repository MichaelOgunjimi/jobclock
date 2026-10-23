import { randomUUID } from "node:crypto"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { withPlatformAiKeyAccess, type UserPreferences } from "@/lib/ai"
import { runAiAction } from "@/lib/ai/action"
import { aiErrorResponse } from "@/lib/ai/http"
import { aiGenerateRateLimit } from "@/lib/rate-limit"
import {
  loadInterviewAnswers,
  loadInterviewApplicationById,
  loadInterviewQuestionById,
} from "@/app/(dashboard)/interview/data"

const requestSchema = z.object({
  questionId: z.string().uuid(),
  applicationId: z.string().uuid().nullable().optional(),
  answer: z.string().trim().min(1).max(5_000),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { success: withinLimit } = await aiGenerateRateLimit.limit(user.id)
  if (!withinLimit) {
    return Response.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      { status: 429 },
    )
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 })
  }

  const question = await loadInterviewQuestionById(user.id, parsed.data.questionId)
  if (!question) {
    return Response.json({ error: "Question not found" }, { status: 404 })
  }

  const applicationId = parsed.data.applicationId ?? null
  const application = applicationId
    ? await loadInterviewApplicationById(user.id, applicationId)
    : null
  if (applicationId && !application) {
    return Response.json({ error: "Application not found" }, { status: 404 })
  }

  const [{ data: profile }, answers] = await Promise.all([
    supabase
      .from("profiles")
      .select("preferences, allow_platform_ai_key")
      .eq("id", user.id)
      .single(),
    loadInterviewAnswers(user.id),
  ])
  const savedAnswer = answers.find(
    (answer) =>
      answer.questionId === question.id &&
      (answer.applicationId ?? null) === applicationId &&
      answer.status === "saved",
  )

  const preferences = withPlatformAiKeyAccess(
    (profile?.preferences ?? {}) as UserPreferences,
    profile?.allow_platform_ai_key === true,
  )

  const systemPrompt = `You are a tough but fair interview coach. Give direct, useful feedback. Do not invent candidate experiences, claims, metrics, or facts.`
  const userPrompt = `## Interview context
${application
  ? `The candidate is practising for ${application.title ?? "this role"} at ${application.company ?? "this company"}.

Job description:
${application.description || "Not available."}

Company research:
${application.researchContent?.trim() || "No saved company research is available."}`
  : "The candidate is practising a reusable general interview answer."}

## Question
${question.text}

## Candidate's practice answer
${parsed.data.answer}

## Saved answer for this context
${savedAnswer?.content || "No saved answer exists for this context."}

## Instructions
Evaluate the practice answer using exactly this markdown structure:

### What worked
- Specific strengths in the answer.

### What was missing
- Specific gaps, especially missing evidence, unclear personal action, or weak relevance.

### Structure check
One short paragraph on whether the answer had a clear opening, evidence, action, and result.

### Next attempt
Rewrite only the first 2-3 sentences to show a stronger opening.`

  try {
    const feedback = await runAiAction(
      { userId: user.id, actionId: randomUUID(), feature: "interview_answer", preferences },
      (ai) => ai.generate(systemPrompt, userPrompt, 1_200),
    )
    return Response.json({ feedback })
  } catch (error) {
    return aiErrorResponse(error, "Evaluation failed")
  }
}
