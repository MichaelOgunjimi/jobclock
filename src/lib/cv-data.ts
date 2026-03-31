import type { CvData } from "@/lib/supabase/database.types"

export type NormalizedCvData = CvData & {
  experience: NonNullable<CvData["experience"]>
  education: CvData["education"]
  projects: NonNullable<CvData["projects"]>
  skills: CvData["skills"]
  languages: NonNullable<CvData["languages"]>
  certifications: NonNullable<CvData["certifications"]>
  activities: NonNullable<CvData["activities"]>
}

export function normalizeCvData(data: CvData | null | undefined): NormalizedCvData {
  return {
    ...data,
    experience: data?.experience ?? [],
    education: data?.education ?? [],
    projects: data?.projects ?? [],
    skills: data?.skills ?? [],
    languages: data?.languages ?? [],
    certifications: data?.certifications ?? [],
    activities: data?.activities ?? [],
  }
}

function cleanStringArray(values: string[] | null | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean)
}

export function sanitizeCvData(data: CvData | null | undefined): NormalizedCvData {
  const normalized = normalizeCvData(data)

  return {
    ...normalized,
    skills: cleanStringArray(normalized.skills),
    languages: cleanStringArray(normalized.languages),
    certifications: cleanStringArray(normalized.certifications),
    experience: normalized.experience.map((entry) => ({
      ...entry,
      highlights: cleanStringArray(entry.highlights),
    })),
    education: normalized.education.map((entry) => ({
      ...entry,
      relevant_modules: cleanStringArray(entry.relevant_modules),
    })),
    projects: normalized.projects.map((entry) => ({
      ...entry,
      technologies: cleanStringArray(entry.technologies),
      highlights: cleanStringArray(entry.highlights),
    })),
    activities: normalized.activities.map((entry) => ({
      ...entry,
      highlights: cleanStringArray(entry.highlights),
    })),
  }
}
