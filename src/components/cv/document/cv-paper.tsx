import { forwardRef } from "react"
import { cn } from "@/lib/utils"
import type { CvData } from "@/lib/supabase/database.types"
import { CvTemplateRenderer, type CvTemplateName } from "@/components/cv/templates/cv-template-renderer"

const CV_A4_WIDTH_MM = 210
const CV_A4_HEIGHT_MM = 297

const CV_A4_WIDTH_STYLE = `${CV_A4_WIDTH_MM}mm`
const CV_A4_MIN_HEIGHT_STYLE = `${CV_A4_HEIGHT_MM}mm`

interface CvPaperProps {
  cv: CvData
  template: CvTemplateName
  className?: string
  paperClassName?: string
  includeShadow?: boolean
}

export const CvPaper = forwardRef<HTMLDivElement, CvPaperProps>(function CvPaper(
  {
    cv,
    template,
    className,
    paperClassName,
    includeShadow = true,
  },
  ref,
) {
  return (
    <div className={cn("flex w-full justify-center", className)}>
      <div
        ref={ref}
        data-cv-paper="true"
        className={cn(
          "overflow-hidden bg-white text-black",
          includeShadow && "shadow-[0_28px_70px_rgba(15,23,42,0.14)]",
          paperClassName,
        )}
        style={{
          width: CV_A4_WIDTH_STYLE,
          minHeight: CV_A4_MIN_HEIGHT_STYLE,
        }}
      >
        <CvTemplateRenderer cv={cv} template={template} />
      </div>
    </div>
  )
})
