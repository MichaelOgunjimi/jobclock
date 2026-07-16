import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { aiGenerateRateLimit } from "@/lib/rate-limit"
import {
  generateText,
  resolveAiConfig,
  withPlatformAiKeyAccess,
  type UserPreferences,
} from "@/lib/ai"
import { parseDiscoveryDraft } from "@/lib/interview/parse-generation"
import { loadInterviewQuestionById } from "@/app/(dashboard)/interview/data"

export const maxDuration = 180

const requestSchema = z.object({
  questionId: z.string().uuid(),
  responses: z
    .array(
      z.object({
        prompt: z.string().trim().min(1).max(1_000),
        answer: z.string().trim().min(1).max(5_000),
      }),
    )
    .min(1)
    .max(6),
})

const SYSTEM_PROMPT = `You help a candidate discover honest interview evidence from their own responses.
Return valid JSON only.
Use "story_found" only when the candidate describes a real event that actually happened.
Never invent an event, action, result, tool, metric, date, responsibility, or employer.
If there is useful but incomplete evidence, return "partial_evidence".
If the candidate has no real example, return "no_example" with an honest answer and a hypothetical approach.

The response must match exactly one of these shapes:
{"outcome":"story_found","story":{"title":"...","situation":"...","task":"...","action":"...","result":"...","tags":["..."]}}
{"outcome":"partial_evidence","honestAnswer":"...","limitations":"..."}
{"outcome":"no_example","honestAnswer":"...","hypotheticalApproach":"..."}`

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json(
      { error: "Add a response before continuing" },
      { status: 400 },
    )
  }

  const { success: withinLimit } = await aiGenerateRateLimit.limit(user.id)
  if (!withinLimit) {
    return Response.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      { status: 429 },
    )
  }

  const question = await loadInterviewQuestionById(
    user.id,
    parsed.data.questionId,
  )
  if (!question) {
    return Response.json({ error: "Question not found" }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences, allow_platform_ai_key")
    .eq("id", user.id)
    .single()

  let aiConfig: ReturnType<typeof resolveAiConfig>
  try {
    aiConfig = resolveAiConfig(
      withPlatformAiKeyAccess(
        (profile?.preferences ?? {}) as UserPreferences,
        profile?.allow_platform_ai_key === true,
      ),
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

  const responseText = parsed.data.responses
    .map(
      (response, index) =>
        `${index + 1}. Prompt: ${response.prompt}\nCandidate: ${response.answer}`,
    )
    .join("\n\n")
  const userPrompt = `Interview question: ${question.text}
Question category: ${question.category}

Candidate responses:
${responseText}

Decide whether these responses contain a real, usable story. Preserve the candidate's meaning and return JSON only.`

  try {
    const generated = await generateText(
      aiConfig.settings,
      aiConfig.apiKey,
      SYSTEM_PROMPT,
      userPrompt,
      1_200,
      { timeoutMs: 180_000 },
    )
    return Response.json(parseDiscoveryDraft(generated))
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Evidence discovery failed",
      },
      { status: 502 },
    )
  }
}
