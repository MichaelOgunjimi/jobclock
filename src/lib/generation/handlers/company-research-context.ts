import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications, jobsCache, profiles } from "@/lib/db/schema"
import { withPlatformAiKeyAccess, type UserPreferences } from "@/lib/ai"
import type { GenerationJob } from "../jobs"

export interface CompanyResearchContext {
  userId: string
  applicationId: string
  company: string
  title: string
  description: string
  preferences: UserPreferences
}

export async function loadCompanyResearchContext(
  job: GenerationJob,
): Promise<CompanyResearchContext> {
  const applicationId = job.applicationId!
  const userId = job.userId

  const [appRows, profileRows] = await Promise.all([
    db
      .select({
        company: jobsCache.company,
        title: jobsCache.title,
        description: jobsCache.description,
        customDescription: applications.customDescription,
        customTitle: applications.customTitle,
        customCompany: applications.customCompany,
      })
      .from(applications)
      .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
      .where(and(eq(applications.id, applicationId), eq(applications.userId, userId))),
    db
      .select({
        preferences: profiles.preferences,
        allowPlatformAiKey: profiles.allowPlatformAiKey,
      })
      .from(profiles)
      .where(eq(profiles.id, userId)),
  ])

  const app = appRows[0]
  if (!app) throw new Error(`Application not found: ${applicationId}`)

  const description = app.customDescription ?? app.description ?? ""
  const profile = profileRows[0] as
    | { preferences?: unknown; allowPlatformAiKey?: boolean | null }
    | undefined

  return {
    userId,
    applicationId,
    company: app.customCompany ?? app.company ?? "this company",
    title: app.customTitle ?? app.title ?? "this role",
    description,
    preferences: withPlatformAiKeyAccess(
      (profile?.preferences ?? null) as UserPreferences | null,
      profile?.allowPlatformAiKey,
    ),
  }
}
