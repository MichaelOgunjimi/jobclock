import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { interviewPrep } from "@/lib/db/schema"
import { resolveAiConfig, generateText } from "@/lib/ai"
import { callPerplexity } from "@/lib/ai/perplexity"
import { decrypt } from "@/lib/crypto"
import { normalizeAiMarkdown } from "@/lib/cv/normalize"
import { interviewSystemPrompt, interviewUserPrompt } from "@/lib/prompts/interview"
import type { GenerationJob } from "../jobs"
import { loadInterviewPrepContext, type StoryRow } from "./interview-prep-context"

function formatStoryBank(stories: StoryRow[]): string {
  if (!stories.length) return "No stories in the story bank yet."
  return stories
    .map(
      (s, i) =>
        `Story ${i + 1}: "${s.title}"\n  Situation: ${s.situation ?? "—"}\n  Task: ${s.task ?? "—"}\n  Action: ${s.action ?? "—"}\n  Result: ${s.result ?? "—"}\n  Tags: ${(s.tags ?? []).join(", ") || "none"}`,
    )
    .join("\n\n")
}

/**
 * interview_prep generation handler. Generates interview questions, story
 * mappings and checklist; upserts to interview_prep; returns row id.
 */
export async function interviewPrepHandler(job: GenerationJob): Promise<string> {
  const ctx = await loadInterviewPrepContext(job)

  const systemPrompt = interviewSystemPrompt()
  const userPrompt = interviewUserPrompt({
    title: ctx.title,
    company: ctx.company,
    description: ctx.description,
    storyBankText: formatStoryBank(ctx.stories),
  })

  let content: string
  const rawPerplexityKey = ctx.preferences.perplexity_api_key
  if (rawPerplexityKey) {
    content = await callPerplexity(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { apiKey: decrypt(rawPerplexityKey), model: "sonar-pro", maxTokens: 3000 },
    )
  } else {
    const { settings, apiKey } = resolveAiConfig(ctx.preferences)
    content = await generateText(settings, apiKey, systemPrompt, userPrompt, 3000)
  }

  const normalized = normalizeAiMarkdown(content)
  const questions = normalized
    .split("\n")
    .filter((line) => /^\*\*Q\d+\.\*\*|^Q\d+\./.test(line.trim()))
    .map((line) => line.trim())

  const existing = await db
    .select({ id: interviewPrep.id })
    .from(interviewPrep)
    .where(eq(interviewPrep.applicationId, ctx.applicationId))
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(interviewPrep)
      .set({ questions, suggestedAnswers: { raw: normalized, storyCount: ctx.stories.length } })
      .where(eq(interviewPrep.applicationId, ctx.applicationId))
    return existing[0].id
  }

  const [inserted] = await db
    .insert(interviewPrep)
    .values({
      applicationId: ctx.applicationId,
      questions,
      suggestedAnswers: { raw: normalized, storyCount: ctx.stories.length },
    })
    .returning({ id: interviewPrep.id })

  return inserted.id
}
