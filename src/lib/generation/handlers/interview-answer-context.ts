import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications, jobsCache, profiles, storyBank } from "@/lib/db/schema"
import type { UserPreferences } from "@/lib/ai"
import type { GenerationJob } from "../jobs"

export interface InterviewAnswerContext {
  userId: string
  applicationId: string
  questionText: string
  storyText: string
  jdContext: string
  preferences: UserPreferences
}

export async function loadInterviewAnswerContext(
  job: GenerationJob,
): Promise<InterviewAnswerContext> {
  const applicationId = job.applicationId!
  const userId = job.userId
  const params = job.params as { questionText: string; storyId: string }
  if (!params?.questionText || !params?.storyId) {
    throw new Error("interview_answer job is missing params.questionText or params.storyId")
  }

  const [appRows, profileRows, storyRows] = await Promise.all([
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
      .select({ preferences: profiles.preferences })
      .from(profiles)
      .where(eq(profiles.id, userId)),
    db
      .select()
      .from(storyBank)
      .where(and(eq(storyBank.id, params.storyId), eq(storyBank.userId, userId))),
  ])

  const app = appRows[0]
  if (!app) throw new Error(`Application not found: ${applicationId}`)

  const story = storyRows[0]
  if (!story) throw new Error(`Story not found: ${params.storyId}`)

  const description = (app.customDescription ?? app.description ?? "").slice(0, 800)
  const jdContext = `Role: ${app.title ?? "the role"} at ${app.company ?? "the company"}.\n${description}`

  const storyText = [
    `Title: ${story.title}`,
    `Situation: ${story.situation ?? "—"}`,
    `Task: ${story.task ?? "—"}`,
    `Action: ${story.action ?? "—"}`,
    `Result: ${story.result ?? "—"}`,
  ].join("\n")

  return {
    userId,
    applicationId,
    questionText: params.questionText,
    storyText,
    jdContext,
    preferences: (((profileRows[0] as { preferences?: unknown } | undefined)?.preferences) ?? {}) as UserPreferences,
  }
}
