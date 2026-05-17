import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  applications,
  jobsCache,
  userCvs,
  profiles,
  coverLetterStructures,
  interviewPrep,
} from "@/lib/db/schema"
import { buildCvContext } from "@/lib/cover-letter/cv-context"
import type { CvData } from "@/lib/supabase/database.types"
import type { UserPreferences } from "@/lib/ai"
import type { GenerationJob } from "../jobs"

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

export async function loadCoverLetterContext(
  job: GenerationJob,
): Promise<CoverLetterContext> {
  const applicationId = job.applicationId!
  const userId = job.userId

  // Round 1: application + profile in parallel
  const [appRows, profileRows] = await Promise.all([
    db
      .select({
        selectedCvId: applications.selectedCvId,
        structureId: applications.structureId,
        coverLetterTone: applications.coverLetterTone,
        customDescription: applications.customDescription,
        title: jobsCache.title,
        company: jobsCache.company,
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
  if (!description?.trim()) {
    throw new Error("No job description found for this application.")
  }

  // Round 2: CV, structure, research in parallel — queries built from round 1 data
  const cvQuery = app.selectedCvId
    ? db
        .select({ parsedJson: userCvs.parsedJson })
        .from(userCvs)
        .where(eq(userCvs.id, app.selectedCvId))
    : db
        .select({ parsedJson: userCvs.parsedJson })
        .from(userCvs)
        .where(and(eq(userCvs.userId, userId), eq(userCvs.isPrimary, true)))

  const structureQuery = app.structureId
    ? db
        .select({ content: coverLetterStructures.content, defaultTone: coverLetterStructures.defaultTone })
        .from(coverLetterStructures)
        .where(eq(coverLetterStructures.id, app.structureId))
    : db
        .select({ content: coverLetterStructures.content, defaultTone: coverLetterStructures.defaultTone })
        .from(coverLetterStructures)
        .where(and(eq(coverLetterStructures.isBuiltIn, true), eq(coverLetterStructures.slug, "professional")))

  const [cvRows, structureRows, researchRows] = await Promise.all([
    cvQuery,
    structureQuery,
    db
      .select({ researchContent: interviewPrep.researchContent })
      .from(interviewPrep)
      .where(eq(interviewPrep.applicationId, applicationId)),
  ])

  const cvParsed = ((cvRows[0] as { parsedJson?: unknown } | undefined)?.parsedJson as CvData | null) ?? null
  const structure = (structureRows[0] as { content?: string; defaultTone?: string | null } | undefined) ?? null
  const companyResearch =
    ((researchRows[0] as { researchContent?: string | null } | undefined)?.researchContent?.trim()) || undefined

  const tone = app.coverLetterTone ?? structure?.defaultTone ?? "professional"
  const preferences = (((profileRows[0] as { preferences?: unknown } | undefined)?.preferences) ?? {}) as UserPreferences

  return {
    userId,
    applicationId,
    title: app.title ?? "the role",
    company: app.company ?? "the company",
    description,
    cvContext: buildCvContext(cvParsed),
    templateSnippet: structure?.content ?? "",
    companyResearch,
    tone,
    preferences,
  }
}
