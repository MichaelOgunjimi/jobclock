import { forwardRef } from "react"
import { cn } from "@/lib/utils"
import type { CvData } from "@/lib/supabase/database.types"
import { CvTemplateRenderer, type CvTemplateName } from "@/components/cv/templates/cv-template-renderer"
import {
  CV_A4_MIN_HEIGHT_STYLE,
  CV_A4_WIDTH_STYLE,
} from "@/components/cv/document/cv-page-metrics"

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
          boxSizing: "border-box",
          printColorAdjust: "exact",
          WebkitPrintColorAdjust: "exact",
        }}
      >
        <CvTemplateRenderer cv={cv} template={template} />
      </div>
    </div>
  )
})
