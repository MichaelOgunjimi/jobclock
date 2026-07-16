import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications, jobsCache, profiles, storyBank } from "@/lib/db/schema"
import { withPlatformAiKeyAccess, type UserPreferences } from "@/lib/ai"
import type { GenerationJob } from "../jobs"

export interface StoryRow {
  id: string
  title: string
  situation: string | null
  task: string | null
  action: string | null
  result: string | null
  tags: string[] | null
}

export interface InterviewPrepContext {
  userId: string
  applicationId: string
  title: string
  company: string
  description: string
  stories: StoryRow[]
  preferences: UserPreferences
}

export async function loadInterviewPrepContext(
  job: GenerationJob,
): Promise<InterviewPrepContext> {
  const applicationId = job.applicationId!
  const userId = job.userId

  const [appRows, profileRows, stories] = await Promise.all([
    db
      .select({
        title: jobsCache.title,
        company: jobsCache.company,
        description: jobsCache.description,
        customDescription: applications.customDescription,
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
    db
      .select()
      .from(storyBank)
      .where(eq(storyBank.userId, userId))
      .orderBy(storyBank.createdAt),
  ])

  const app = appRows[0]
  if (!app) throw new Error(`Application not found: ${applicationId}`)
  const profile = profileRows[0] as
    | { preferences?: unknown; allowPlatformAiKey?: boolean | null }
    | undefined

  return {
    userId,
    applicationId,
    title: app.title ?? "this role",
    company: app.company ?? "this company",
    description: app.customDescription ?? app.description ?? "",
    stories: stories as unknown as StoryRow[],
    preferences: withPlatformAiKeyAccess(
      (profile?.preferences ?? null) as UserPreferences | null,
      profile?.allowPlatformAiKey,
    ),
  }
}
