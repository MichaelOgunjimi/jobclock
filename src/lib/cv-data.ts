import type { CvData } from "@/lib/supabase/database.types"

export type NormalizedCvData = CvData & {
  experience: NonNullable<CvData["experience"]>
  education: CvData["education"]
  projects: NonNullable<CvData["projects"]>
  skills: CvData["skills"]
  languages: NonNullable<CvData["languages"]>
  certifications: NonNullable<CvData["certifications"]>
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
  }
}