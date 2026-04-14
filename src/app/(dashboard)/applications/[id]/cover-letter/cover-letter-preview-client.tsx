"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Copy, Download, PenLine, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-styles"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useDownloadPdf } from "@/hooks/use-download-pdf"
import { cn } from "@/lib/utils"
import type { CvData, CoverLetterRenderData } from "@/lib/supabase/database.types"
import { CoverLetterPreviewStage } from "@/components/cover-letter/document/cover-letter-preview-stage"
import {
  CL_TEMPLATE_LABELS,
  CL_TEMPLATE_NAMES,
  type CoverLetterTemplateName,
  isCoverLetterTemplateName,
} from "@/components/cover-letter/templates/cover-letter-template-renderer"
import {
  saveCoverLetterContent,
  saveCoverLetterTemplatePreference,
} from "./actions"

interface Props {
  applicationId: string
  coverLetterId: string
  content: string
  tone: string | null
  generatedAt: string
  senderCv: CvData | null
  jobTitle: string | null
  jobCompany: string | null
  initialTemplate: string
}

function TemplateSwitcher({
  value,
  onChange,
}: {
  value: CoverLetterTemplateName
  onChange: (value: CoverLetterTemplateName) => void
}) {
  return (
    <>
      <div className="hidden items-center overflow-hidden border sm:flex">
        {CL_TEMPLATE_NAMES.map((template) => {
          const isActive = template === value
          return (
            <button
              key={template}
              type="button"
              onClick={() => onChange(template)}
              aria-pressed={isActive}
              className={cn(
                "min-w-20 border-r px-3 py-2 text-[11px] font-semibold uppercase tracking-widest transition-colors last:border-r-0",
                isActive
                  ? "bg-foreground text-background"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {CL_TEMPLATE_LABELS[template]}
            </button>
          )
        })}
      </div>

      <div className="sm:hidden">
        <select
          value={value}
          onChange={(event) =>
            onChange(event.target.value as CoverLetterTemplateName)
          }
          className="form-select h-10 min-w-[10rem] bg-background text-[12px]"
          aria-label="Select cover letter template"
        >
          {CL_TEMPLATE_NAMES.map((template) => (
            <option key={template} value={template}>
              {CL_TEMPLATE_LABELS[template]}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}

export function CoverLetterPreviewClient({
  applicationId,
  coverLetterId,
  content: initialContent,
  tone,
  generatedAt,
  senderCv,
  jobTitle,
  jobCompany,
  initialTemplate,
}: Props) {
  const [content, setContent] = useState(initialContent)
  const [template, setTemplate] = useState<CoverLetterTemplateName>(
    isCoverLetterTemplateName(initialTemplate) ? initialTemplate : "modern",
  )
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(initialContent)
  const { handleDownloadPdf, isDownloading } = useDownloadPdf({
    type: "cover-letter",
    applicationId,
    template,
    filenamePrefix: "cover-letter",
    onBeforeDownload: async () => {
      if (hasUnsavedChanges) {
        return handleSave()
      }
      return true
    },
  })

  const hasUnsavedChanges = content !== lastSavedSnapshot

  useEffect(() => {
    document.body.classList.add("cl-workspace-active")
    return () => {
      document.body.classList.remove("cl-workspace-active")
    }
  }, [])

  const renderData: CoverLetterRenderData = {
    content,
    sender: {
      name: senderCv?.name,
      email: senderCv?.email,
      phone: senderCv?.phone,
      location: senderCv?.location,
      linkedin: senderCv?.linkedin,
      website: senderCv?.website,
    },
    recipient: {
      company: jobCompany ?? undefined,
      jobTitle: jobTitle ?? undefined,
    },
    date: new Date(generatedAt).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  }

  async function handleSave() {
    setIsSaving(true)
    const result = await saveCoverLetterContent({
      applicationId,
      coverLetterId,
      content,
    })
    setIsSaving(false)

    if (result?.error) {
      toast.error(result.error)
      return false
    }

    setLastSavedSnapshot(content)
    toast.success("Cover letter saved")
    return true
  }

  function handleTemplateChange(nextTemplate: CoverLetterTemplateName) {
    setTemplate(nextTemplate)
    void saveCoverLetterTemplatePreference(nextTemplate)
  }

  function handleCopy() {
    void navigator.clipboard.writeText(content)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="cl-workspace flex min-h-[calc(100vh-4rem)] flex-col bg-background lg:h-[calc(100vh-73px)]">
      <div className="border-b px-4 py-3 sm:px-6 lg:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/applications/${applicationId}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span>{hasUnsavedChanges ? "Unsaved changes" : "Saved"}</span>
            <span className="hidden sm:inline">Cover Letter Workspace</span>
          </div>
        </div>
      </div>

      <div className={cn(
        "flex flex-1 flex-col gap-4 px-4 py-4 sm:px-6 lg:min-h-0 lg:gap-4 lg:px-5 lg:py-5",
        isEditorOpen
          ? "lg:grid lg:grid-cols-[minmax(24rem,0.82fr)_minmax(48rem,1.18fr)] xl:grid-cols-[minmax(24rem,0.78fr)_minmax(52rem,1.22fr)]"
          : "lg:grid lg:grid-cols-1"
      )}>
        {/* Preview panel */}
        <div className={cn("order-1 -mx-4 flex min-h-0 flex-col sm:-mx-6 lg:mx-0 lg:w-full lg:max-w-none", isEditorOpen && "lg:order-2")}>
          <div className="mb-3 border-y bg-background sm:border">
            <div className="flex flex-col gap-4 px-4 py-3 sm:px-5 lg:px-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Template
                  </span>
                  <TemplateSwitcher
                    value={template}
                    onChange={handleTemplateChange}
                  />
                </div>

                <div className="flex items-center gap-2">
                  {tone && (
                    <span className="inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      {tone}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[auto_auto_auto_auto_1fr] sm:items-center">
                <Button
                  type="button"
                  size="sm"
                  variant={isEditorOpen ? "default" : "outline"}
                  onClick={() => setIsEditorOpen((v) => !v)}
                  className="w-full sm:w-auto"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  {isEditorOpen ? "Close Editor" : "Edit"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!hasUnsavedChanges || isSaving}
                  onClick={() => void handleSave()}
                  className="w-full sm:w-auto"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSaving ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSaving || isDownloading}
                  onClick={() => void handleDownloadPdf()}
                  className="w-full sm:w-auto"
                >
                  <Download className="h-3.5 w-3.5" />
                  {isDownloading ? "Generating…" : "Download PDF"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="w-full sm:w-auto"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <div className="hidden justify-end sm:flex">
                  <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Cover Letter Workspace
                  </span>
                </div>
              </div>
            </div>
          </div>

          <ScrollArea className="border-y bg-[linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.05))] sm:border lg:min-h-0 lg:flex-1">
            <div className="px-1 py-2 sm:px-3 sm:py-4 lg:px-4 lg:py-4 xl:px-5">
              <CoverLetterPreviewStage data={renderData} template={template} />
            </div>
          </ScrollArea>
        </div>

        {/* Editor panel */}
        {isEditorOpen && (
          <div className="order-2 min-h-0 lg:order-1 lg:min-w-0">
            <ScrollArea className="lg:h-full">
              <div className="space-y-4 pr-0 lg:pr-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="cl-content"
                    className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Cover Letter Body
                  </label>
                  <textarea
                    id="cl-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={20}
                    className="w-full resize-y border bg-background px-3 py-2 text-[13px] leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Write your cover letter body here..."
                  />
                </div>

                {/* Read-only sender context */}
                {senderCv?.name && (
                  <div className="space-y-2 border bg-secondary/30 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Header info (from your CV)
                    </p>
                    <div className="space-y-0.5 text-[12px] text-muted-foreground">
                      {senderCv.name && <p>{senderCv.name}</p>}
                      {senderCv.email && <p>{senderCv.email}</p>}
                      {senderCv.phone && <p>{senderCv.phone}</p>}
                      {senderCv.location && <p>{senderCv.location}</p>}
                    </div>
                  </div>
                )}

                {/* Read-only recipient context */}
                {(jobTitle || jobCompany) && (
                  <div className="space-y-2 border bg-secondary/30 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Recipient info (from job)
                    </p>
                    <div className="space-y-0.5 text-[12px] text-muted-foreground">
                      {jobCompany && <p>{jobCompany}</p>}
                      {jobTitle && <p>Re: {jobTitle}</p>}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  )
}
