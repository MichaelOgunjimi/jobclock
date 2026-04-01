"use client"

import { useEffect, useRef, useState } from "react"
import type { CoverLetterRenderData } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"
import { CoverLetterPaper } from "@/components/cover-letter/document/cover-letter-paper"
import type { CoverLetterTemplateName } from "@/components/cover-letter/templates/cover-letter-template-renderer"

const A4_WIDTH_PX = (210 / 25.4) * 96

export function CoverLetterPreviewStage({
  data,
  template,
  className,
}: {
  data: CoverLetterRenderData
  template: CoverLetterTemplateName
  className?: string
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [contentHeight, setContentHeight] = useState(0)

  useEffect(() => {
    function update() {
      const viewport = viewportRef.current
      const content = contentRef.current
      if (!viewport) return

      const viewportWidth = viewport.clientWidth
      const gutter = viewportWidth < 640 ? 16 : 4
      const availableWidth = Math.max(viewportWidth - gutter, 0)
      setScale(Math.min(1, availableWidth / A4_WIDTH_PX))

      if (content) setContentHeight(content.scrollHeight)
    }

    update()

    const observer = new ResizeObserver(() => update())
    if (viewportRef.current) observer.observe(viewportRef.current)
    if (contentRef.current) observer.observe(contentRef.current)

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={viewportRef} className={cn("w-full", className)}>
      <div
        className="cl-preview-paper-shell overflow-hidden"
        style={{
          width: A4_WIDTH_PX * scale,
          height: contentHeight > 0 ? contentHeight * scale : "auto",
          margin: "0 auto",
        }}
      >
        <div
          ref={contentRef}
          className="cl-preview-paper-scale"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: A4_WIDTH_PX,
          }}
        >
          <CoverLetterPaper
            data={data}
            template={template}
            className="shrink-0"
            includeShadow
          />
        </div>
      </div>
    </div>
  )
}
