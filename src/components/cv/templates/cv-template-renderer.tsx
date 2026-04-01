import type { CvData } from "@/lib/supabase/database.types"
import { TemplateClassic } from "@/components/cv/templates/template-classic"
import { TemplateMinimal } from "@/components/cv/templates/template-minimal"
import { TemplateModern } from "@/components/cv/templates/template-modern"
import { TemplateBold } from "@/components/cv/templates/template-bold"
import { TemplateCompact } from "@/components/cv/templates/template-compact"
import { TemplateSidebar } from "@/components/cv/templates/template-sidebar"
import { TemplateProfessional } from "@/components/cv/templates/template-professional"

export const CV_TEMPLATE_NAMES = ["classic", "modern", "minimal", "bold", "compact", "sidebar", "professional"] as const

export type CvTemplateName = (typeof CV_TEMPLATE_NAMES)[number]

export const CV_TEMPLATE_LABELS: Record<CvTemplateName, string> = {
  classic: "Classic",
  modern: "Modern",
  minimal: "Minimal",
  bold: "Bold",
  compact: "Compact",
  sidebar: "Sidebar",
  professional: "Professional",
}

export function isCvTemplateName(value: string | null | undefined): value is CvTemplateName {
  return CV_TEMPLATE_NAMES.includes(value as CvTemplateName)
}

export function CvTemplateRenderer({
  cv,
  template,
}: {
  cv: CvData
  template: CvTemplateName
}) {
  if (template === "classic") return <TemplateClassic cv={cv} />
  if (template === "minimal") return <TemplateMinimal cv={cv} />
  if (template === "bold") return <TemplateBold cv={cv} />
  if (template === "compact") return <TemplateCompact cv={cv} />
  if (template === "sidebar") return <TemplateSidebar cv={cv} />
  if (template === "professional") return <TemplateProfessional cv={cv} />
  return <TemplateModern cv={cv} />
}
