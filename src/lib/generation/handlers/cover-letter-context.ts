import type { GenerationJob } from "../jobs"
import type { UserPreferences } from "@/lib/ai"

export interface CoverLetterContext {
  userId: string
  applicationId: string
  title: string
  company: string
  description: string
  cvContext: string
  templateSnippet: string
  companyResearch: string | undefined
  tone: string
  preferences: UserPreferences
}

/**
 * Gathers everything the cover-letter handler needs, scoped to the job's
 * user/application, via the direct Drizzle connection (no request context).
 * Real implementation added in its own tracer.
 */
export async function loadCoverLetterContext(
  _job: GenerationJob,
): Promise<CoverLetterContext> {
  throw new Error("loadCoverLetterContext not implemented")
}
