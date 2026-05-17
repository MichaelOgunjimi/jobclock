import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { interviewPrep } from "@/lib/db/schema"
import { resolveAiConfig, generateText } from "@/lib/ai"
import { interviewAnswerSystemPrompt, interviewAnswerPrompt } from "@/lib/prompts/interview"
import type { GenerationJob } from "../jobs"
import { loadInterviewAnswerContext } from "./interview-answer-context"

/**
 * interview_answer generation handler. Generates a STAR answer for one
 * question; stores it in interview_prep.suggested_answers under the question
 * text key. Returns the interview_prep row id as the result_ref.
 */
export async function interviewAnswerHandler(job: GenerationJob): Promise<string> {
  const ctx = await loadInterviewAnswerContext(job)

  const { settings, apiKey } = resolveAiConfig(ctx.preferences)
  const systemPrompt = interviewAnswerSystemPrompt()
  const userPrompt = interviewAnswerPrompt({
    question: ctx.questionText,
    story: ctx.storyText,
    jdContext: ctx.jdContext,
  })

  const answer = (await generateText(settings, apiKey, systemPrompt, userPrompt)).trim()

  const existing = await db
    .select({ id: interviewPrep.id, suggestedAnswers: interviewPrep.suggestedAnswers })
    .from(interviewPrep)
    .where(eq(interviewPrep.applicationId, ctx.applicationId))
    .limit(1)

  if (existing.length > 0) {
    const prev = (existing[0].suggestedAnswers as Record<string, unknown> | null) ?? {}
    const answers = (prev.answers as Record<string, string> | undefined) ?? {}
    await db
      .update(interviewPrep)
      .set({ suggestedAnswers: { ...prev, answers: { ...answers, [ctx.questionText]: answer } } })
      .where(eq(interviewPrep.applicationId, ctx.applicationId))
    return existing[0].id
  }

  const [inserted] = await db
    .insert(interviewPrep)
    .values({
      applicationId: ctx.applicationId,
      suggestedAnswers: { answers: { [ctx.questionText]: answer } },
    })
    .returning({ id: interviewPrep.id })

  return inserted.id
}
