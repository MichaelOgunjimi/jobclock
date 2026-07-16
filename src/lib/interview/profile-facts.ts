import { createHash } from "node:crypto"
import { sanitizeCvData } from "@/lib/cv-data"
import type {
  CvData,
  CvEducation,
  CvExperience,
  CvProject,
} from "@/lib/supabase/database.types"
import type {
  ProfileFactCategory,
  ProfileFactDraft,
} from "./types"

// Server-side extractor: do not import this Node crypto module into Client Components.

interface ProfileFactCandidate {
  draft: Omit<ProfileFactDraft, "sourceRef">
  logicalRef: string
  contentDigest: string
}

function clean(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? ""
}

function join(values: Array<string | null | undefined>): string {
  return values.map(clean).filter(Boolean).join(" | ")
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "entry"
  )
}

function stableDigest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

function logicalSourceRef(
  category: ProfileFactCategory,
  label: string,
  fields: Array<string | null | undefined>,
): string {
  const normalizedFields = fields.map(clean)
  return `cv:${category}:${slug(label)}:${stableDigest(JSON.stringify(normalizedFields))}`
}

function createCandidate(
  category: ProfileFactCategory,
  label: string,
  detail: string,
  logicalRef: string,
  contentFields: Array<string | null | undefined>,
): ProfileFactCandidate {
  const contentDigest = stableDigest(JSON.stringify(contentFields.map(clean)))
  return {
    draft: {
      category,
      label,
      detail,
      sourceType: "cv",
      logicalSourceRef: logicalRef,
      contentDigest,
      confirmedAt: null,
    },
    logicalRef,
    contentDigest,
  }
}

function educationDraft(entry: CvEducation): ProfileFactCandidate | null {
  const degree = clean(entry.degree)
  const institution = clean(entry.institution)
  if (!degree || !institution) return null

  const contentFields = [
    entry.degree,
    entry.institution,
    entry.field,
    entry.start_date,
    entry.end_date,
    entry.grade,
    entry.location,
    entry.gpa,
    entry.honors,
    ...(entry.relevant_modules ?? []),
  ]
  const dates = join([entry.start_date, entry.end_date])
  const detail = join([
    institution,
    entry.field,
    dates,
    entry.grade,
    entry.gpa,
    entry.honors,
    entry.location,
    ...(entry.relevant_modules ?? []),
  ])

  return createCandidate(
    "education",
    degree,
    detail,
    logicalSourceRef("education", degree, [
      entry.degree,
      entry.institution,
      entry.start_date,
      entry.end_date,
    ]),
    contentFields,
  )
}

function experienceDraft(
  entry: CvExperience,
  category: "experience" | "activity",
): ProfileFactCandidate | null {
  const title = clean(entry.title)
  const company = clean(entry.company)
  if (!title || !company) return null

  const label = `${title} at ${company}`
  const contentFields = [
    entry.title,
    entry.company,
    entry.start_date,
    entry.end_date,
    entry.description,
    entry.location,
    ...(entry.highlights ?? []),
  ]
  const dates = join([entry.start_date, entry.end_date])
  const detail =
    join([
      entry.description,
      ...(entry.highlights ?? []),
      dates,
      entry.location,
    ]) || join([title, company])

  return createCandidate(
    category,
    label,
    detail,
    logicalSourceRef(category, label, [
      entry.title,
      entry.company,
      entry.start_date,
      entry.end_date,
    ]),
    contentFields,
  )
}

function projectDraft(entry: CvProject): ProfileFactCandidate | null {
  const name = clean(entry.name)
  if (!name) return null

  const contentFields = [
    entry.name,
    entry.description,
    entry.start_date,
    entry.end_date,
    entry.url,
    entry.code_url,
    ...(entry.technologies ?? []),
    ...(entry.highlights ?? []),
  ]
  const dates = join([entry.start_date, entry.end_date])
  const detail =
    join([
      entry.description,
      ...(entry.highlights ?? []),
      ...(entry.technologies ?? []),
      dates,
      entry.url,
      entry.code_url,
    ]) || name

  return createCandidate(
    "project",
    name,
    detail,
    logicalSourceRef("project", name, [
      entry.name,
      entry.url,
      entry.code_url,
      entry.start_date,
      entry.end_date,
    ]),
    contentFields,
  )
}

function stringDrafts(
  values: string[],
  category: "skill" | "certification" | "language",
): ProfileFactCandidate[] {
  return values.map((value) =>
    createCandidate(
      category,
      value,
      value,
      logicalSourceRef(category, value, [value]),
      [value],
    ),
  )
}

export function extractProfileFactDrafts(
  data: CvData | null | undefined,
): ProfileFactDraft[] {
  if (!data) return []

  const cv = sanitizeCvData(data)
  const candidates: ProfileFactCandidate[] = []
  const summary = clean(cv.summary)

  if (summary) {
    candidates.push(
      createCandidate(
        "summary",
        "Profile summary",
        summary,
        "cv:summary:profile-summary",
        [summary],
      ),
    )
  }

  candidates.push(
    ...cv.education.flatMap((entry) => {
      const draft = educationDraft(entry)
      return draft ? [draft] : []
    }),
    ...cv.experience.flatMap((entry) => {
      const draft = experienceDraft(entry, "experience")
      return draft ? [draft] : []
    }),
    ...cv.projects.flatMap((entry) => {
      const draft = projectDraft(entry)
      return draft ? [draft] : []
    }),
    ...stringDrafts(cv.skills, "skill"),
    ...stringDrafts(cv.languages, "language"),
    ...stringDrafts(cv.certifications, "certification"),
    ...cv.activities.flatMap((entry) => {
      const draft = experienceDraft(entry, "activity")
      return draft ? [draft] : []
    }),
  )

  // logicalSourceRef groups versions for review; sourceRef pins exact CV content, so changed versions require review and reconfirmation.
  const seenSources = new Set<string>()
  return candidates.flatMap((candidate) => {
    const sourceRef = `${candidate.logicalRef}:${candidate.contentDigest}`
    if (seenSources.has(sourceRef)) return []
    seenSources.add(sourceRef)

    return [
      {
        ...candidate.draft,
        sourceRef,
      },
    ]
  })
}
