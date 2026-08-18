import { and, asc, desc, eq, or } from "drizzle-orm"
import type { InferSelectModel } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  applications,
  applicationStatusEvents,
  coverLetters,
  coverLetterStructures,
  customizedCvs,
  interviewAnswers,
  interviewPrep,
  interviewQuestions,
  jobsCache,
  offers,
  userCvs,
} from "@/lib/db/schema"

type Application = InferSelectModel<typeof applications>
type Job = InferSelectModel<typeof jobsCache>
type StatusEvent = InferSelectModel<typeof applicationStatusEvents>
type CoverLetter = InferSelectModel<typeof coverLetters>
type CustomizedCv = InferSelectModel<typeof customizedCvs>
type InterviewPreparation = InferSelectModel<typeof interviewPrep>
type InterviewQuestion = InferSelectModel<typeof interviewQuestions>
type InterviewAnswer = InferSelectModel<typeof interviewAnswers>
type Offer = InferSelectModel<typeof offers>
type UserCv = InferSelectModel<typeof userCvs>
type CoverLetterStructure = InferSelectModel<typeof coverLetterStructures>

export interface ApplicationExportSource {
  application: Application
  job: Job | null
  selectedCv: UserCv | null
  writingStyle: CoverLetterStructure | null
  tailoredCvs: CustomizedCv[]
  coverLetters: CoverLetter[]
  statusHistory: StatusEvent[]
  interviewPreparations: InterviewPreparation[]
  interviewAnswers: Array<{
    answer: InterviewAnswer
    question: InterviewQuestion
  }>
  interviewQuestions: InterviewQuestion[]
  offers: Offer[]
}

function omitKeys<T extends object, K extends keyof T>(row: T, keys: readonly K[]): Omit<T, K> {
  const exportable = { ...row }
  for (const key of keys) delete exportable[key]
  return exportable
}

function withoutUserId<T extends { userId: unknown }>(row: T): Omit<T, "userId"> {
  return omitKeys(row, ["userId"])
}

function exportSelectedCv(cv: UserCv | null) {
  if (!cv) return null
  return omitKeys(cv, ["userId", "originalFilePath", "filePath"])
}

function exportTailoredCv(cv: CustomizedCv) {
  return omitKeys(cv, ["userId", "pdfPath"])
}

export function createApplicationExport(
  source: ApplicationExportSource,
  exportedAt = new Date().toISOString(),
) {
  const { application, job } = source

  return {
    format: "jobclock.application-export",
    version: 1,
    exportedAt,
    purpose:
      "Portable context for continuing work on this job application in another chat or generative AI tool.",
    summary: {
      role: application.customTitle ?? job?.title ?? null,
      company: application.customCompany ?? job?.company ?? null,
      location: application.customLocation ?? job?.location ?? null,
      salary: {
        display: application.customSalaryText,
        minimum: job?.salaryMin ?? null,
        maximum: job?.salaryMax ?? null,
        currency: job?.salaryCurrency ?? null,
      },
      description: application.customDescription ?? job?.description ?? null,
      status: application.status,
    },
    application: withoutUserId(application),
    job,
    selectedCv: exportSelectedCv(source.selectedCv),
    writingStyle: source.writingStyle ? withoutUserId(source.writingStyle) : null,
    tailoredCvs: source.tailoredCvs.map(exportTailoredCv),
    coverLetters: source.coverLetters.map(withoutUserId),
    statusHistory: source.statusHistory.map(withoutUserId),
    interview: {
      preparations: source.interviewPreparations,
      questions: source.interviewQuestions.map(withoutUserId),
      answers: source.interviewAnswers.map(({ answer, question }) => ({
        ...withoutUserId(answer),
        question: withoutUserId(question),
      })),
    },
    offers: source.offers.map(withoutUserId),
  }
}

export async function loadApplicationExport(userId: string, applicationId: string) {
  const [applicationRecord] = await db
    .select({ application: applications, job: jobsCache })
    .from(applications)
    .leftJoin(jobsCache, eq(applications.jobId, jobsCache.id))
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    .limit(1)

  if (!applicationRecord) return null

  const { application } = applicationRecord
  const selectedCvQuery = application.selectedCvId
    ? db
        .select()
        .from(userCvs)
        .where(and(eq(userCvs.id, application.selectedCvId), eq(userCvs.userId, userId)))
        .limit(1)
    : Promise.resolve([] as UserCv[])
  const writingStyleQuery = application.structureId
    ? db
        .select()
        .from(coverLetterStructures)
        .where(
          and(
            eq(coverLetterStructures.id, application.structureId),
            or(
              eq(coverLetterStructures.userId, userId),
              eq(coverLetterStructures.isBuiltIn, true),
            ),
          ),
        )
        .limit(1)
    : Promise.resolve([] as CoverLetterStructure[])

  const [
    selectedCvs,
    writingStyles,
    tailoredCvs,
    generatedCoverLetters,
    statusHistory,
    interviewPreparations,
    answerRows,
    applicationQuestions,
    applicationOffers,
  ] = await Promise.all([
    selectedCvQuery,
    writingStyleQuery,
    db
      .select()
      .from(customizedCvs)
      .where(and(eq(customizedCvs.applicationId, applicationId), eq(customizedCvs.userId, userId)))
      .orderBy(desc(customizedCvs.createdAt)),
    db
      .select()
      .from(coverLetters)
      .where(and(eq(coverLetters.applicationId, applicationId), eq(coverLetters.userId, userId)))
      .orderBy(desc(coverLetters.createdAt)),
    db
      .select()
      .from(applicationStatusEvents)
      .where(
        and(
          eq(applicationStatusEvents.applicationId, applicationId),
          eq(applicationStatusEvents.userId, userId),
        ),
      )
      .orderBy(asc(applicationStatusEvents.createdAt)),
    db
      .select()
      .from(interviewPrep)
      .where(eq(interviewPrep.applicationId, applicationId))
      .orderBy(desc(interviewPrep.createdAt)),
    db
      .select({ answer: interviewAnswers, question: interviewQuestions })
      .from(interviewAnswers)
      .innerJoin(interviewQuestions, eq(interviewAnswers.questionId, interviewQuestions.id))
      .where(
        and(
          eq(interviewAnswers.applicationId, applicationId),
          eq(interviewAnswers.userId, userId),
          eq(interviewQuestions.userId, userId),
        ),
      )
      .orderBy(desc(interviewAnswers.updatedAt)),
    db
      .select()
      .from(interviewQuestions)
      .where(
        and(
          eq(interviewQuestions.applicationId, applicationId),
          eq(interviewQuestions.userId, userId),
        ),
      )
      .orderBy(asc(interviewQuestions.createdAt)),
    db
      .select()
      .from(offers)
      .where(and(eq(offers.applicationId, applicationId), eq(offers.userId, userId))),
  ])

  return createApplicationExport({
    application,
    job: applicationRecord.job,
    selectedCv: selectedCvs[0] ?? null,
    writingStyle: writingStyles[0] ?? null,
    tailoredCvs,
    coverLetters: generatedCoverLetters,
    statusHistory,
    interviewPreparations,
    interviewAnswers: answerRows,
    interviewQuestions: applicationQuestions,
    offers: applicationOffers,
  })
}
