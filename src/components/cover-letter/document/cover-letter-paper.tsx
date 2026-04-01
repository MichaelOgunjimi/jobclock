import { forwardRef } from "react"
import { cn } from "@/lib/utils"
import type { CoverLetterRenderData } from "@/lib/supabase/database.types"
import {
  CoverLetterTemplateRenderer,
  type CoverLetterTemplateName,
} from "@/components/cover-letter/templates/cover-letter-template-renderer"

const CL_A4_WIDTH_MM = 210
const CL_A4_HEIGHT_MM = 297

const CL_A4_WIDTH_STYLE = `${CL_A4_WIDTH_MM}mm`
const CL_A4_MIN_HEIGHT_STYLE = `${CL_A4_HEIGHT_MM}mm`

interface CoverLetterPaperProps {
  data: CoverLetterRenderData
  template: CoverLetterTemplateName
  className?: string
  paperClassName?: string
  includeShadow?: boolean
}

export const CoverLetterPaper = forwardRef<HTMLDivElement, CoverLetterPaperProps>(
  function CoverLetterPaper(
    { data, template, className, paperClassName, includeShadow = true },
    ref,
  ) {
    return (
      <div className={cn("flex w-full justify-center", className)}>
        <div
          ref={ref}
          data-cover-letter-paper="true"
          className={cn(
            "overflow-hidden bg-white text-black",
            includeShadow && "shadow-[0_28px_70px_rgba(15,23,42,0.14)]",
            paperClassName,
          )}
          style={{
            width: CL_A4_WIDTH_STYLE,
            minHeight: CL_A4_MIN_HEIGHT_STYLE,
          }}
        >
          <CoverLetterTemplateRenderer data={data} template={template} />
        </div>
      </div>
    )
  },
)
