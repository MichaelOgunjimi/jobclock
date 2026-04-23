import { z } from "zod/v4"
import { eq } from "drizzle-orm"
import { extractJson } from "@/lib/ai/extract-json"
import { generateText, resolveAiConfig, type UserPreferences } from "@/lib/ai"
import { JOB_IMPORT_SYSTEM_PROMPT, buildJobImportUserPrompt } from "@/lib/ai/prompts/job-import"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { detectSourceFromUrl } from "@/lib/jobs/source-detection"

export class JobImportError extends Error {
  status: number

  constructor(message: string, status = 422) {
    super(message)
    this.name = "JobImportError"
    this.status = status
  }
}

const optText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return null
    const cleaned = value.trim()
    return cleaned ? cleaned : null
  })

const optNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === "") return null
    const numeric = typeof value === "number" ? value : Number(value)
    return Number.isFinite(numeric) ? numeric : null
  })

const optBoolean = z
  .union([z.boolean(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null || value === "") return null
    if (typeof value === "boolean") return value
    const normalized = value.trim().toLowerCase()
    if (["true", "yes", "1"].includes(normalized)) return true
    if (["false", "no", "0"].includes(normalized)) return false
    return null
  })

export const jobImportPreviewSchema = z.object({
  url: z.string().url(),
  source: z.string().trim().min(1),
  title: z.string().trim().min(1),
  company: z.string().trim().min(1),
  location: optText,
  description: optText,
  salaryMin: optNumber,
  salaryMax: optNumber,
  salaryCurrency: optText,
  postedAt: optText,
  isEasyApply: optBoolean,
})

export type JobImportPreview = z.infer<typeof jobImportPreviewSchema>

export const jobImportHintsSchema = z.object({
  title: optText.optional(),
  company: optText.optional(),
  location: optText.optional(),
  description: optText.optional(),
  salaryText: optText.optional(),
  metadata: z.array(z.string()).max(20).optional(),
})

export type JobImportHints = z.infer<typeof jobImportHintsSchema>

function sanitizePageText(pageText: string): string {
  return pageText
    .replace(/\u0000/g, " ")
    .replace(/\s{3,}/g, "\n\n")
    .trim()
    .slice(0, 70_000)
}

export function isSubstantialDescription(value: string | null | undefined): value is string {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false

  const wordCount = trimmed.split(/\s+/).length
  return wordCount >= 50 || trimmed.length >= 300
}

export function chooseDescription(parsedDescription: string | null, hintedDescription: string | null): string | null {
  if (isSubstantialDescription(hintedDescription)) {
    return hintedDescription
  }

  if (parsedDescription) {
    return parsedDescription
  }

  return hintedDescription
}

function normalizePreview(
  parsed: Record<string, unknown>,
  url: string,
  fallbackSource: string,
  pageTitle: string,
  hints?: JobImportHints
): JobImportPreview {
  const parsedDescription =
    typeof parsed.description === "string" && parsed.description.trim()
      ? parsed.description
      : null
  const hintedDescription = hints?.description ?? null

  const candidate = {
    url,
    source: typeof parsed.source === "string" && parsed.source.trim() ? parsed.source : fallbackSource,
    title:
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title
        : hints?.title || pageTitle,
    company:
      typeof parsed.company === "string" && parsed.company.trim()
        ? parsed.company
        : hints?.company,
    location:
      typeof parsed.location === "string" && parsed.location.trim()
        ? parsed.location
        : hints?.location,
    description: chooseDescription(parsedDescription, hintedDescription),
    salaryMin: parsed.salaryMin,
    salaryMax: parsed.salaryMax,
    salaryCurrency: parsed.salaryCurrency ?? "GBP",
    postedAt: parsed.postedAt,
    isEasyApply: parsed.isEasyApply,
  }

  const result = jobImportPreviewSchema.safeParse(candidate)
  if (!result.success) {
    throw new JobImportError("AI returned an invalid job preview. Please try again.")
  }

  return result.data
}

export async function parseImportedJobPreview(input: {
  userId: string
  url: string
  pageTitle?: string
  pageHints?: JobImportHints
  pageText: string
}): Promise<JobImportPreview> {
  const [profile] = await db
    .select({ preferences: profiles.preferences })
    .from(profiles)
    .where(eq(profiles.id, input.userId))
    .limit(1)

  const preferences = (profile?.preferences ?? null) as UserPreferences | null

  let settings
  let apiKey
  try {
    const resolved = resolveAiConfig(preferences)
    settings = resolved.settings
    apiKey = resolved.apiKey
  } catch (error) {
    throw new JobImportError(
      error instanceof Error ? error.message : "No AI provider is configured for job import."
    )
  }

  const pageTitle = input.pageTitle?.trim() || "Untitled job page"
  const suggestedSource = detectSourceFromUrl(input.url)

  const response = await generateText(
    settings,
    apiKey,
    JOB_IMPORT_SYSTEM_PROMPT,
    buildJobImportUserPrompt({
      url: input.url,
      pageTitle,
      suggestedSource,
      pageHints: input.pageHints,
      pageText: sanitizePageText(input.pageText),
    }),
    1200
  )

  let extracted: unknown
  try {
    extracted = extractJson(response)
  } catch {
    throw new JobImportError("AI returned unparseable job data. Please try again.")
  }

  if (typeof extracted !== "object" || extracted === null || Array.isArray(extracted)) {
    throw new JobImportError("AI returned an invalid job payload. Please try again.")
  }

  return normalizePreview(
    extracted as Record<string, unknown>,
    input.url,
    suggestedSource,
    pageTitle,
    input.pageHints
  )
}
