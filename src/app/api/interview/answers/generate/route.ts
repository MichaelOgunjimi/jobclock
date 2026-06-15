import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { aiGenerateRateLimit } from "@/lib/rate-limit"
import { generateText, resolveAiConfig, type UserPreferences } from "@/lib/ai"
import { normalizeAiMarkdown } from "@/lib/cv/normalize"
import { assessEvidence } from "@/lib/interview/evidence"
import { resolveQuestionDefinition } from "@/lib/interview/question-catalog"
import {
  buildInterviewAnswerPrompt,
  INTERVIEW_ANSWER_SYSTEM_PROMPT,
} from "@/lib/interview/prompts"
import type {
  InterviewQuestionCategory,
  ProfileFactEvidence,
  StoryEvidence,
} from "@/lib/interview/types"
import {
  loadInterviewApplicationById,
  loadInterviewFacts,
  loadInterviewQuestionById,
  loadInterviewStories,
  loadPrimaryInterviewCvDrafts,
} from "@/app/(dashboard)/interview/data"

export const maxDuration = 180

const requestSchema = z.object({
  questionId: z.string().uuid(),
  applicationId: z.string().uuid().nullable().optional(),
})

function iso(value: unknown): string | null {
  if (value == null) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

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

  const questionRow = await loadInterviewQuestionById(
    user.id,
    parsed.data.questionId,
  )
  if (!questionRow) {
    return Response.json({ error: "Question not found" }, { status: 404 })
  }

  const [factRows, storyRows, currentCvDrafts] = await Promise.all([
    loadInterviewFacts(user.id),
    loadInterviewStories(user.id),
    loadPrimaryInterviewCvDrafts(user.id),
  ])

  const currentCvRefs = new Set(currentCvDrafts.map((draft) => draft.sourceRef))
  const facts: ProfileFactEvidence[] = factRows.map((fact) => ({
    id: fact.id,
    category: fact.category,
    label: fact.label,
    detail: fact.detail,
    tags: [fact.category],
    confirmedAt: iso(fact.confirmedAt),
    updatedAt: iso(fact.updatedAt) ?? new Date(0).toISOString(),
    sourceType:
      fact.sourceType === "cv" ||
      fact.sourceType === "manual" ||
      fact.sourceType === "discovery"
        ? fact.sourceType
        : "manual",
    sourceRef: fact.sourceRef,
    isCurrentSource:
      fact.sourceType !== "cv" ||
      currentCvRefs.has(fact.sourceRef ?? ""),
  }))
  const stories: StoryEvidence[] = storyRows.map((story) => ({
    id: story.id,
    category: story.tags?.[0],
    title: story.title,
    situation: story.situation,
    task: story.task,
    action: story.action,
    result: story.result,
    tags: story.tags ?? [],
    confirmedAt: iso(story.confirmedAt),
    updatedAt: iso(story.updatedAt) ?? new Date(0).toISOString(),
  }))

  const question = resolveQuestionDefinition({
    key: questionRow.sourceRef ?? questionRow.id,
    text: questionRow.text,
    category: questionRow.category as InterviewQuestionCategory,
  })
  const assessment = assessEvidence(question, facts, stories)
  if (!assessment.sufficient) {
    return Response.json(
      {
        status: "needs_evidence",
        reason: assessment.reason,
        suggestedPrompts: assessment.suggestedPrompts,
      },
      { status: 409 },
    )
  }

  const applicationId = parsed.data.applicationId ?? null
  const application = applicationId
    ? await loadInterviewApplicationById(user.id, applicationId)
    : null
  if (applicationId && !application) {
    return Response.json({ error: "Application not found" }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single()

  let aiConfig: ReturnType<typeof resolveAiConfig>
  try {
    aiConfig = resolveAiConfig(
      (profile?.preferences ?? {}) as UserPreferences,
    )
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No AI API key configured",
      },
      { status: 422 },
    )
  }

  const selectedFacts = facts.filter((fact) =>
    assessment.evidence.factIds.includes(fact.id),
  )
  const selectedStories = stories.filter((story) =>
    assessment.evidence.storyIds.includes(story.id),
  )
  const userPrompt = buildInterviewAnswerPrompt({
    question,
    evidence: { facts: selectedFacts, stories: selectedStories },
    application: application
      ? {
          title: application.title ?? "Untitled role",
          company: application.company ?? "Unknown company",
          description: application.description ?? "",
        }
      : null,
  })

  try {
    const content = normalizeAiMarkdown(
      await generateText(
        aiConfig.settings,
        aiConfig.apiKey,
        INTERVIEW_ANSWER_SYSTEM_PROMPT,
        userPrompt,
        1_500,
        { timeoutMs: 180_000 },
      ),
    ).trim()

    return Response.json({
      content,
      evidenceSnapshot: assessment.evidence,
    })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Answer generation failed",
      },
      { status: 500 },
    )
  }
}
