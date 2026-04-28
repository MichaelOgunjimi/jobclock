"use client"

import { useEffect, useRef, useState } from "react"
import type { CvData } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"
import { CvPaper } from "@/components/cv/document/cv-paper"
import {
  CV_A4_WIDTH_PX,
  getCvA4PageBoundaries,
} from "@/components/cv/document/cv-page-metrics"
import type { CvTemplateName } from "@/components/cv/templates/cv-template-renderer"

export function CvPreviewStage({
  cv,
  template,
  className,
}: {
  cv: CvData
  template: CvTemplateName
  className?: string
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [paperHeight, setPaperHeight] = useState(0)

  useEffect(() => {
    function update() {
      const viewport = viewportRef.current
      const paper = paperRef.current
      if (!viewport) return

      const viewportWidth = viewport.clientWidth
      const gutter = viewportWidth < 640 ? 16 : 4
      const availableWidth = Math.max(viewportWidth - gutter, 0)
      const nextScale = Math.min(1, availableWidth / CV_A4_WIDTH_PX)
      setScale(nextScale)

      if (paper) {
        const measuredHeight = paper.getBoundingClientRect().height / nextScale
        setPaperHeight(Number.isFinite(measuredHeight) ? measuredHeight : paper.scrollHeight)
      }
    }

    update()

    const observer = new ResizeObserver(() => update())
    if (viewportRef.current) observer.observe(viewportRef.current)
    if (contentRef.current) observer.observe(contentRef.current)

    return () => observer.disconnect()
  }, [])

  const pageBoundaries = getCvA4PageBoundaries(paperHeight)

  return (
    <div ref={viewportRef} className={cn("w-full", className)}>
      {/* Shell sized to the scaled dimensions so nothing overflows/clips */}
      <div
        className="cv-preview-paper-shell overflow-hidden"
        style={{
          width: CV_A4_WIDTH_PX * scale,
          height: paperHeight > 0 ? paperHeight * scale : "auto",
          margin: "0 auto",
        }}
      >
        <div
          ref={contentRef}
          className="cv-preview-paper-scale"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: CV_A4_WIDTH_PX,
            position: "relative",
          }}
        >
          <CvPaper
            ref={paperRef}
            cv={cv}
            template={template}
            className="shrink-0"
            includeShadow
          />
          {pageBoundaries.map((boundary) => (
            <div
              key={boundary.page}
              style={{
                position: "absolute",
                top: `${boundary.topMm}mm`,
                left: 0,
                right: 0,
                pointerEvents: "none",
              }}
            >
              <div style={{ borderTop: "2px dashed #ef4444", width: "100%" }} />
              <span
                style={{
                  position: "absolute",
                  right: 8,
                  top: 4,
                  fontSize: 10,
                  fontFamily: "sans-serif",
                  color: "#ef4444",
                  background: "white",
                  padding: "1px 4px",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                End page {boundary.page}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
