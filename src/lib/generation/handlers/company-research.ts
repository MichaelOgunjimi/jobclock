import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { interviewPrep } from "@/lib/db/schema"
import { resolveAiConfig, generateText } from "@/lib/ai"
import { callPerplexity } from "@/lib/ai/perplexity"
import { decrypt } from "@/lib/crypto"
import { normalizeAiMarkdown } from "@/lib/cv/normalize"
import { researchSystemPrompt, researchUserPrompt } from "@/lib/prompts/company-research"
import type { GenerationJob } from "../jobs"
import { loadCompanyResearchContext, type CompanyResearchContext } from "./company-research-context"

async function generateContent(ctx: CompanyResearchContext): Promise<string> {
  const systemPrompt = researchSystemPrompt()
  const userPrompt = researchUserPrompt({
    company: ctx.company,
    title: ctx.title,
    description: ctx.description.slice(0, 1500),
  })

  const rawPerplexityKey = ctx.preferences.perplexity_api_key
  if (rawPerplexityKey) {
    return callPerplexity(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { apiKey: decrypt(rawPerplexityKey), model: "sonar-pro", maxTokens: 3500 },
    )
  }

  const { settings, apiKey } = resolveAiConfig(ctx.preferences)
  return generateText(settings, apiKey, systemPrompt, userPrompt, 3500)
}

async function persistContent(applicationId: string, content: string): Promise<string> {
  const existing = await db
    .select({ id: interviewPrep.id })
    .from(interviewPrep)
    .where(eq(interviewPrep.applicationId, applicationId))
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(interviewPrep)
      .set({ researchContent: content })
      .where(eq(interviewPrep.applicationId, applicationId))
    return existing[0].id
  }

  const [inserted] = await db
    .insert(interviewPrep)
    .values({ applicationId, researchContent: content })
    .returning({ id: interviewPrep.id })

  return inserted.id
}

async function doResearch(job: GenerationJob): Promise<{ content: string; id: string }> {
  const ctx = await loadCompanyResearchContext(job)
  const raw = await generateContent(ctx)
  const content = normalizeAiMarkdown(raw)
  const id = await persistContent(ctx.applicationId, content)
  return { content, id }
}

/**
 * Used by coverLetterHandler for auto-research composition: generates and
 * persists research for the application, returning the content string so the
 * cover letter can use it without a second DB round-trip.
 */
export async function composeResearch(job: GenerationJob): Promise<string> {
  return (await doResearch(job)).content
}

/**
 * company_research generation handler. Runs in the QStash callback with no
 * request context. Returns the interview_prep row id as the result_ref.
 */
export async function companyResearchHandler(job: GenerationJob): Promise<string> {
  return (await doResearch(job)).id
}
