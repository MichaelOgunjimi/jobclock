import { and, eq, ne } from "drizzle-orm"
import { db } from "@/lib/db"
import { coverLetters } from "@/lib/db/schema"
import { resolveAiConfig, generateText } from "@/lib/ai"
import { buildCoverLetterSystemPrompt, buildCoverLetterUserPrompt } from "@/lib/ai/prompts"
import { normalizeCoverLetterText } from "@/lib/cover-letter/normalize"
import type { GenerationJob } from "../jobs"
import { loadCoverLetterContext } from "./cover-letter-context"

/**
 * cover_letter generation handler. Runs in the QStash callback (no request
 * context): identity comes from the job, data access is direct Drizzle scoped
 * to job.userId. Returns the new cover_letters id (the job result_ref).
 */
export async function coverLetterHandler(job: GenerationJob): Promise<string> {
  const ctx = await loadCoverLetterContext(job)

  const { settings, apiKey } = resolveAiConfig(ctx.preferences)
  const systemPrompt = buildCoverLetterSystemPrompt(`Write in a ${ctx.tone} tone.`)
  const userPrompt = buildCoverLetterUserPrompt({
    title: ctx.title,
    company: ctx.company,
    description: ctx.description,
    cvContext: ctx.cvContext,
    templateSnippet: ctx.templateSnippet,
    companyResearch: ctx.companyResearch,
  })

  const content = await generateText(settings, apiKey, systemPrompt, userPrompt)

  const [inserted] = await db
    .insert(coverLetters)
    .values({
      userId: ctx.userId,
      applicationId: ctx.applicationId,
      label: `AI — ${ctx.title} at ${ctx.company}`,
      content: normalizeCoverLetterText(content),
      tone: ctx.tone,
    })
    .returning({ id: coverLetters.id })

  // Replace any previously generated letters for this application.
  await db
    .delete(coverLetters)
    .where(
      and(
        eq(coverLetters.applicationId, ctx.applicationId),
        eq(coverLetters.userId, ctx.userId),
        ne(coverLetters.id, inserted.id),
      ),
    )

  return inserted.id
}
