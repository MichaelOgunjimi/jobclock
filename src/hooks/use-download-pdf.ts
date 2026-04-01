"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"

interface UseDownloadPdfOptions {
  type: "cv" | "cover-letter"
  applicationId: string
  template: string
  filenamePrefix: string
  onBeforeDownload?: () => Promise<boolean>
}

export function useDownloadPdf({
  type,
  applicationId,
  template,
  filenamePrefix,
  onBeforeDownload,
}: UseDownloadPdfOptions) {
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadPdf = useCallback(async () => {
    setIsDownloading(true)
    toast.info("Generating PDF — this may take a moment…")

    if (onBeforeDownload) {
      const ok = await onBeforeDownload()
      if (!ok) {
        setIsDownloading(false)
        return
      }
    }

    try {
      const res = await fetch(
        `/api/applications/${applicationId}/${type}/pdf?template=${template}`,
      )
      if (!res.ok) throw new Error("PDF generation failed")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${filenamePrefix}-${template}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("PDF downloaded")
    } catch {
      toast.error("Failed to generate PDF — please try again")
    } finally {
      setIsDownloading(false)
    }
  }, [type, applicationId, template, filenamePrefix, onBeforeDownload])

  return { handleDownloadPdf, isDownloading }
}
