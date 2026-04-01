import type { CoverLetterRenderData } from "@/lib/supabase/database.types"
import { CoverLetterClassic } from "@/components/cover-letter/templates/template-classic"
import { CoverLetterModern } from "@/components/cover-letter/templates/template-modern"
import { CoverLetterElegant } from "@/components/cover-letter/templates/template-elegant"
import { CoverLetterProfessional } from "@/components/cover-letter/templates/template-professional"

export const CL_TEMPLATE_NAMES = ["classic", "modern", "elegant", "professional"] as const

export type CoverLetterTemplateName = (typeof CL_TEMPLATE_NAMES)[number]

export const CL_TEMPLATE_LABELS: Record<CoverLetterTemplateName, string> = {
  classic: "Classic",
  modern: "Modern",
  elegant: "Elegant",
  professional: "Professional",
}

export function isCoverLetterTemplateName(
  value: string | null | undefined,
): value is CoverLetterTemplateName {
  return CL_TEMPLATE_NAMES.includes(value as CoverLetterTemplateName)
}

export function CoverLetterTemplateRenderer({
  data,
  template,
}: {
  data: CoverLetterRenderData
  template: CoverLetterTemplateName
}) {
  if (template === "classic") return <CoverLetterClassic data={data} />
  if (template === "elegant") return <CoverLetterElegant data={data} />
  if (template === "professional") return <CoverLetterProfessional data={data} />
  return <CoverLetterModern data={data} />
}
