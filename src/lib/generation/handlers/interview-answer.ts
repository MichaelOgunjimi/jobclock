import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { interviewPrep } from "@/lib/db/schema"
import { resolveAiConfig, generateText } from "@/lib/ai"
import { interviewAnswerSystemPrompt, interviewAnswerPrompt } from "@/lib/prompts/interview"
import type { GenerationJob } from "../jobs"
import { loadInterviewAnswerContext } from "./interview-answer-context"
import { appendApplicationAuditEvents } from "@/lib/applications/audit"

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

  return db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: interviewPrep.id, suggestedAnswers: interviewPrep.suggestedAnswers })
      .from(interviewPrep)
      .where(eq(interviewPrep.applicationId, ctx.applicationId))
      .limit(1)
    let prepId = existing[0]?.id

    if (prepId) {
      const prev = (existing[0].suggestedAnswers as Record<string, unknown> | null) ?? {}
      const answers = (prev.answers as Record<string, string> | undefined) ?? {}
      await tx
        .update(interviewPrep)
        .set({ suggestedAnswers: { ...prev, answers: { ...answers, [ctx.questionText]: answer } } })
        .where(eq(interviewPrep.applicationId, ctx.applicationId))
    } else {
      const [inserted] = await tx
        .insert(interviewPrep)
        .values({
          applicationId: ctx.applicationId,
          suggestedAnswers: { answers: { [ctx.questionText]: answer } },
        })
        .returning({ id: interviewPrep.id })
      prepId = inserted.id
    }

    const params = job.params as { storyId?: string } | null
    await appendApplicationAuditEvents(tx, {
      applicationId: ctx.applicationId,
      userId: ctx.userId,
      eventType: "application.interview_answer_generated",
      metadata: {
        interviewPrepId: prepId,
        generationJobId: job.id,
        storyId: params?.storyId,
        questionCharacters: ctx.questionText.length,
        answerCharacters: answer.length,
      },
    })
    return prepId
  })
}
