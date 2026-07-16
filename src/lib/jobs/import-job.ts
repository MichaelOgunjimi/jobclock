import { z } from "zod/v4"
import { eq } from "drizzle-orm"
import { extractJson } from "@/lib/ai/extract-json"
import {
  generateText,
  resolveAiConfig,
  withPlatformAiKeyAccess,
  type UserPreferences,
} from "@/lib/ai"
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

function sanitizePageText(pageText: string, maxChars = 70_000): string {
  return pageText
    .replace(/\u0000/g, " ")
    .replace(/\s{3,}/g, "\n\n")
    .trim()
    .slice(0, maxChars)
}

// When the extension's content script returned a real description hint
// (e.g. LinkedIn's `.jobs-description__content`), it is the actual job
// description verbatim. Send a small slice of pageText alongside for
// scraps the hint might miss (badges, perks blocks) instead of feeding
// the model 70k chars of noisy feed/sidebar content.
const RELIABLE_HINT_MIN_CHARS = 400
const PAGETEXT_CAP_WITH_RELIABLE_HINT = 4_000

function cleanCandidateText(value: string | null | undefined): string | null {
  if (!value) return null
  const cleaned = value.trim()
  return cleaned ? cleaned : null
}

export function deriveTitleAndCompanyFromPageTitle(pageTitle: string): {
  title: string | null
  company: string | null
} {
  const normalized = pageTitle.replace(/\s+/g, " ").trim()
  if (!normalized) {
    return { title: null, company: null }
  }

  const stripKnownSites = (value: string) =>
    value.replace(
      /\b(totaljobs|linkedin|indeed|glassdoor|reed|adzuna|careerjet|jobsite)\b/gi,
      ""
    ).replace(/\s+/g, " ").trim()

  for (const separator of [" - ", " | ", " — ", " – "]) {
    const parts = normalized.split(separator).map((part) => stripKnownSites(part)).filter(Boolean)
    if (parts.length >= 2) {
      return {
        title: cleanCandidateText(parts[0]),
        company: cleanCandidateText(parts[1]),
      }
    }
  }

  const atMatch = normalized.match(/^(.+?)\s+at\s+(.+)$/i)
  if (atMatch) {
    return {
      title: cleanCandidateText(stripKnownSites(atMatch[1])),
      company: cleanCandidateText(stripKnownSites(atMatch[2])),
    }
  }

  return { title: cleanCandidateText(stripKnownSites(normalized)), company: null }
}

export function isSubstantialDescription(value: string | null | undefined): value is string {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false

  const wordCount = trimmed.split(/\s+/).length
  return wordCount >= 50 || trimmed.length >= 300
}

export function chooseDescription(parsedDescription: string | null, hintedDescription: string | null): string | null {
  // Prefer the AI-formatted markdown version when the model returned
  // something substantial. The raw DOM hint is unstructured innerText
  // (no paragraph breaks, no headings) — the AI reformats it into
  // markdown while preserving content, so users get a readable result.
  //
  // Compression guard: if the AI's output is dramatically shorter than
  // the raw hint, the model likely summarised against instructions —
  // fall back to the raw hint so we never lose content.
  if (parsedDescription && isSubstantialDescription(parsedDescription)) {
    const parsedLen = parsedDescription.trim().length
    const hintedLen = hintedDescription?.trim().length ?? 0
    if (hintedLen === 0 || parsedLen >= hintedLen * 0.6) {
      return parsedDescription
    }
  }

  if (isSubstantialDescription(hintedDescription)) {
    return hintedDescription
  }

  return parsedDescription ?? hintedDescription
}

function parseSalaryValue(value: string): number | null {
  const match = value.match(/\d[\d,.]*/)
  if (!match) return null

  const numeric = Number(match[0].replace(/,/g, ""))
  if (!Number.isFinite(numeric)) return null

  return /k/i.test(value) ? numeric * 1000 : numeric
}

export function parseSalaryText(value: string | null | undefined): {
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
} | null {
  if (!value) return null

  const cleaned = value.replace(/\s+/g, " ").trim()
  if (!cleaned) return null

  const currency = /€|eur/i.test(cleaned)
    ? "EUR"
    : /\$|usd/i.test(cleaned)
      ? "USD"
      : /£|gbp/i.test(cleaned)
        ? "GBP"
        : null

  if (!currency) return null

  const salaryValues = cleaned.match(/(?:£|\$|€|gbp|usd|eur)?\s*\d[\d,.]*(?:\s*k)?/gi) ?? []
  const parsedValues = salaryValues.map(parseSalaryValue).filter((salary): salary is number => salary !== null)

  if (parsedValues.length === 0) return null

  if (parsedValues.length === 1) {
    return {
      salaryMin: parsedValues[0],
      salaryMax: null,
      salaryCurrency: currency,
    }
  }

  return {
    salaryMin: Math.min(...parsedValues),
    salaryMax: Math.max(...parsedValues),
    salaryCurrency: currency,
  }
}

export function buildFallbackPreview(input: {
  url: string
  fallbackSource: string
  pageTitle: string
  hints?: JobImportHints
  pageText: string
}): JobImportPreview | null {
  const derived = deriveTitleAndCompanyFromPageTitle(input.pageTitle)
  const title = cleanCandidateText(input.hints?.title) ?? derived.title
  const company = cleanCandidateText(input.hints?.company) ?? derived.company

  if (!title || !company) return null

  const easyApplyHint = /easy apply|quick apply/i.test(
    `${input.pageTitle}\n${input.hints?.location ?? ""}\n${input.hints?.description ?? ""}\n${input.pageText.slice(0, 4000)}`
  )
  const parsedSalary = parseSalaryText(input.hints?.salaryText)

  return {
    url: input.url,
    source: input.fallbackSource,
    title,
    company,
    location: cleanCandidateText(input.hints?.location),
    description: chooseDescription(null, cleanCandidateText(input.hints?.description)),
    salaryMin: parsedSalary?.salaryMin ?? null,
    salaryMax: parsedSalary?.salaryMax ?? null,
    salaryCurrency: parsedSalary?.salaryCurrency ?? "GBP",
    postedAt: null,
    isEasyApply: easyApplyHint ? true : null,
  }
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
  const parsedSalary = parseSalaryText(hints?.salaryText)

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
    salaryMin: parsed.salaryMin ?? parsedSalary?.salaryMin,
    salaryMax: parsed.salaryMax ?? parsedSalary?.salaryMax,
    salaryCurrency: parsed.salaryCurrency ?? parsedSalary?.salaryCurrency ?? "GBP",
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
    .select({
      preferences: profiles.preferences,
      allowPlatformAiKey: profiles.allowPlatformAiKey,
    })
    .from(profiles)
    .where(eq(profiles.id, input.userId))
    .limit(1)

  const preferences = withPlatformAiKeyAccess(
    (profile?.preferences ?? null) as UserPreferences | null,
    profile?.allowPlatformAiKey,
  )

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

  const hintedDescriptionLength = input.pageHints?.description?.trim().length ?? 0
  const pageTextCap =
    hintedDescriptionLength >= RELIABLE_HINT_MIN_CHARS
      ? PAGETEXT_CAP_WITH_RELIABLE_HINT
      : 70_000

  const response = await generateText(
    settings,
    apiKey,
    JOB_IMPORT_SYSTEM_PROMPT,
    buildJobImportUserPrompt({
      url: input.url,
      pageTitle,
      suggestedSource,
      pageHints: input.pageHints,
      pageText: sanitizePageText(input.pageText, pageTextCap),
    }),
    4096
  )

  let extracted: unknown
  try {
    extracted = extractJson(response)
  } catch {
    const fallbackPreview = buildFallbackPreview({
      url: input.url,
      fallbackSource: suggestedSource,
      pageTitle,
      hints: input.pageHints,
      pageText: sanitizePageText(input.pageText),
    })
    if (fallbackPreview) {
      return fallbackPreview
    }
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
