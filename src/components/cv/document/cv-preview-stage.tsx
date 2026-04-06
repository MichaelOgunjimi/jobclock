"use client"

import { useEffect, useRef, useState } from "react"
import type { CvData } from "@/lib/supabase/database.types"
import { cn } from "@/lib/utils"
import { CvPaper } from "@/components/cv/document/cv-paper"
import type { CvTemplateName } from "@/components/cv/templates/cv-template-renderer"

const A4_WIDTH_PX = (210 / 25.4) * 96
const A4_HEIGHT_PX = (297 / 25.4) * 96

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
      {/* Shell sized to the scaled dimensions so nothing overflows/clips */}
      <div
        className="cv-preview-paper-shell overflow-hidden"
        style={{
          width: A4_WIDTH_PX * scale,
          height: contentHeight > 0 ? contentHeight * scale : "auto",
          margin: "0 auto",
        }}
      >
        <div
          ref={contentRef}
          className="cv-preview-paper-scale"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: A4_WIDTH_PX,
            position: "relative",
          }}
        >
          <CvPaper
            cv={cv}
            template={template}
            className="shrink-0"
            includeShadow
          />
          {contentHeight > A4_HEIGHT_PX && (
            <div
              style={{
                position: "absolute",
                top: A4_HEIGHT_PX,
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
                A4 limit
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
