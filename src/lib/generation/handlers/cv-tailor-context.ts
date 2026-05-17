import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications, jobsCache, profiles, userCvs } from "@/lib/db/schema"
import type { UserPreferences } from "@/lib/ai"
import type { CvData } from "@/lib/supabase/database.types"
import type { GenerationJob } from "../jobs"

export interface CvTailorContext {
  userId: string
  applicationId: string
  title: string
  company: string
  location: string | null
  description: string
  cvJson: string
  preferences: UserPreferences
}

export async function loadCvTailorContext(job: GenerationJob): Promise<CvTailorContext> {
  const applicationId = job.applicationId!
  const userId = job.userId

  const [appRows, profileRows] = await Promise.all([
    db
      .select({
        selectedCvId: applications.selectedCvId,
        customDescription: applications.customDescription,
        title: jobsCache.title,
        company: jobsCache.company,
        location: jobsCache.location,
        description: jobsCache.description,
      })
      .from(applications)
      .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId))),
    db
      .select({ preferences: profiles.preferences })
      .from(profiles)
      .where(eq(profiles.id, userId)),
  ])

  const app = appRows[0]
  if (!app) throw new Error(`Application not found: ${applicationId}`)

  const description = app.customDescription ?? app.description
  if (!description?.trim()) throw new Error("No job description found for this application.")

  // Resolve base CV: selected_cv_id or primary
  const cvQuery = app.selectedCvId
    ? db
        .select({ parsedJson: userCvs.parsedJson })
        .from(userCvs)
        .where(and(eq(userCvs.id, app.selectedCvId), eq(userCvs.userId, userId)))
    : db
        .select({ parsedJson: userCvs.parsedJson })
        .from(userCvs)
        .where(and(eq(userCvs.userId, userId), eq(userCvs.isPrimary, true)))

  const cvRows = await cvQuery
  const cvParsed = ((cvRows[0] as { parsedJson?: unknown } | undefined)?.parsedJson as CvData | null) ?? null
  if (!cvParsed) throw new Error("No CV found. Upload a CV first.")

  return {
    userId,
    applicationId,
    title: app.title ?? "the role",
    company: app.company ?? "the company",
    location: app.location ?? null,
    description,
    cvJson: JSON.stringify(cvParsed, null, 2),
    preferences: (((profileRows[0] as { preferences?: unknown } | undefined)?.preferences) ?? {}) as UserPreferences,
  }
}
