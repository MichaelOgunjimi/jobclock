"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronDown, Download, Info, PenLine, Printer, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-styles"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useDownloadPdf } from "@/hooks/use-download-pdf"
import { buildCvFilenameBase } from "@/lib/document-filename"
import { cn } from "@/lib/utils"
import type { CvData } from "@/lib/supabase/database.types"
import { normalizeCvData, sanitizeCvData, type NormalizedCvData } from "@/lib/cv-data"
import { CvEditorForm } from "@/components/cv/editor/cv-editor-form"
import { CvPreviewStage } from "@/components/cv/document/cv-preview-stage"
import {
  CV_TEMPLATE_LABELS,
  CV_TEMPLATE_NAMES,
  type CvTemplateName,
} from "@/components/cv/templates/cv-template-renderer"
import { saveCustomizedCvData, saveTemplatePreference } from "./actions"

interface Props {
  customizedCvId: string
  cvData: CvData
  applicationId: string
  atsScore: number | null
  generatedAt: string
  initialTemplate: CvTemplateName
  skillsGap: unknown
  jobTitle: string | null
  jobCompany: string | null
}

function parseSkillsGap(raw: unknown): { gap: string[]; changes: string | null; matched: string[] } {
  if (!raw) return { gap: [], changes: null, matched: [] }
  if (Array.isArray(raw)) return { gap: raw as string[], changes: null, matched: [] }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as { gap?: string[]; changes?: string; matched_keywords?: string[] }
    return { gap: obj.gap ?? [], changes: obj.changes ?? null, matched: obj.matched_keywords ?? [] }
  }
  return { gap: [], changes: null, matched: [] }
}

function getAtsColor(score: number): string {
  if (score >= 75) return "text-green-700 dark:text-green-300"
  if (score >= 50) return "text-amber-700 dark:text-amber-300"
  return "text-destructive"
}

function StatsCardContent({
  atsScore,
  generatedAt,
  skillsGap,
}: {
  atsScore: number | null
  generatedAt: string
  skillsGap: { gap: string[]; changes: string | null; matched: string[] }
}) {
  const date = new Date(generatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  return (
    <div className="space-y-4 p-4 sm:p-5">
      {atsScore != null && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            ATS Score
          </p>
          <p className={cn("text-4xl font-bold tabular-nums", getAtsColor(atsScore))}>
            {atsScore}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/ 100</span>
          </p>
        </div>
      )}

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Generated
        </p>
        <p className="text-sm text-foreground">{date}</p>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Document
        </p>
        <p className="text-sm text-muted-foreground">
          A4 preview stays centered and scales down on smaller screens without stretching
          wider than the paper size.
        </p>
      </div>

      {skillsGap.changes && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Changes
          </p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">{skillsGap.changes}</p>
        </div>
      )}

      {(skillsGap.matched.length > 0 || skillsGap.gap.length > 0) && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Keyword Coverage
          </p>
          {skillsGap.matched.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {skillsGap.matched.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
          {skillsGap.gap.length > 0 && (
            <>
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Missing</p>
              <div className="flex flex-wrap gap-1.5">
                {skillsGap.gap.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TemplateSwitcher({
  value,
  onChange,
}: {
  value: CvTemplateName
  onChange: (value: CvTemplateName) => void
}) {
  return (
    <>
      <div className="hidden items-center overflow-hidden border sm:flex">
        {CV_TEMPLATE_NAMES.map((template) => {
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
              {CV_TEMPLATE_LABELS[template]}
            </button>
          )
        })}
      </div>

      <div className="sm:hidden">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as CvTemplateName)}
          className="form-select h-10 min-w-[10rem] bg-background text-[12px]"
          aria-label="Select CV template"
        >
          {CV_TEMPLATE_NAMES.map((template) => (
            <option key={template} value={template}>
              {CV_TEMPLATE_LABELS[template]}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}

export function CvPreviewClient({
  customizedCvId,
  cvData,
  applicationId,
  atsScore,
  generatedAt,
  initialTemplate,
  skillsGap: rawSkillsGap,
  jobTitle,
  jobCompany,
}: Props) {
  const [data, setData] = useState<NormalizedCvData>(() => normalizeCvData(cvData))
  const [template, setTemplate] = useState<CvTemplateName>(initialTemplate)
  const [isSaving, setIsSaving] = useState(false)
  const [isStatsOpen, setIsStatsOpen] = useState(false)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() =>
    JSON.stringify(normalizeCvData(cvData)),
  )
  const filenameBase = buildCvFilenameBase({
    fullName: data.name,
    company: jobCompany,
    role: jobTitle,
  })
  const { handleDownloadPdf, isDownloading } = useDownloadPdf({
    type: "cv",
    applicationId,
    template,
    filenamePrefix: "tailored-cv",
    filenameBase,
    onBeforeDownload: async () => {
      if (hasUnsavedChanges) {
        return persistCurrentCv(true)
      }
      return true
    },
  })

  const snapshot = JSON.stringify(data)
  const previewData = sanitizeCvData(data)
  const hasUnsavedChanges = snapshot !== lastSavedSnapshot
  const skillsGap = parseSkillsGap(rawSkillsGap)

  useEffect(() => {
    document.body.classList.add("cv-workspace-active")
    return () => {
      document.body.classList.remove("cv-workspace-active")
    }
  }, [])

  async function persistCurrentCv(quiet = false) {
    setIsSaving(true)
    const result = await saveCustomizedCvData({
      applicationId,
      customizedCvId,
      data: sanitizeCvData(data),
    })
    setIsSaving(false)

    if (result?.error) {
      toast.error(result.error)
      return false
    }

    setLastSavedSnapshot(snapshot)
    if (!quiet) {
      toast.success("Tailored CV saved")
    }
    return true
  }

  function handleTemplateChange(nextTemplate: CvTemplateName) {
    setTemplate(nextTemplate)
    void saveTemplatePreference(nextTemplate)
  }

  return (
    <div className="cv-workspace flex min-h-[calc(100vh-4rem)] flex-col bg-background lg:h-[calc(100vh-73px)]">
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
            <span className="hidden sm:inline">Tailored CV Workspace</span>
          </div>
        </div>
      </div>

      <div className={cn(
        "flex flex-1 flex-col gap-4 px-4 py-4 sm:px-6 lg:min-h-0 lg:gap-4 lg:px-5 lg:py-5",
        isEditorOpen
          ? "lg:grid lg:grid-cols-[minmax(24rem,0.82fr)_minmax(48rem,1.18fr)] xl:grid-cols-[minmax(24rem,0.78fr)_minmax(52rem,1.22fr)]"
          : "lg:grid lg:grid-cols-1"
      )}>
        <div className={cn("order-1 -mx-4 flex min-h-0 flex-col sm:-mx-6 lg:mx-0 lg:w-full lg:max-w-none", isEditorOpen && "lg:order-2")}>
          <div className="mb-3 border-y bg-background sm:border">
            <div className="flex flex-col gap-4 px-4 py-3 sm:px-5 lg:px-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Template
                    </span>
                    {atsScore != null && (
                      <span
                        className={cn(
                          "inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]",
                          getAtsColor(atsScore),
                          atsScore >= 75
                            ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/40"
                            : atsScore >= 50
                              ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
                              : "border-destructive/20 bg-destructive/10",
                        )}
                      >
                        ATS {atsScore}
                      </span>
                    )}
                  </div>
                  <TemplateSwitcher value={template} onChange={handleTemplateChange} />
                </div>

                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {hasUnsavedChanges ? "Unsaved changes" : "Saved"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsStatsOpen((value) => !value)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:text-foreground"
                    aria-expanded={isStatsOpen}
                  >
                    <Info className="h-3.5 w-3.5" />
                    Insights
                    <ChevronDown
                      className={cn("h-3.5 w-3.5 transition-transform", isStatsOpen && "rotate-180")}
                    />
                  </button>
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
                  onClick={() => void persistCurrentCv()}
                  className="w-full sm:w-auto"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSaving ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isDownloading || isSaving}
                  onClick={() => void handleDownloadPdf()}
                  className="w-full sm:w-auto"
                >
                  <Download className="h-3.5 w-3.5" />
                  {isDownloading ? "Generating…" : "Download PDF"}
                </Button>
                <Link
                  href={`/applications/${applicationId}/cv/print`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full sm:w-auto")}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print
                </Link>
                <div className="hidden justify-end sm:flex">
                  <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    Tailored CV workspace
                  </span>
                </div>
              </div>

              {isStatsOpen && (
                <div className="border bg-secondary/40">
                  <StatsCardContent
                    atsScore={atsScore}
                    generatedAt={generatedAt}
                    skillsGap={skillsGap}
                  />
                </div>
              )}
            </div>
          </div>

          <ScrollArea className="border-y bg-[linear-gradient(180deg,rgba(15,23,42,0.02),rgba(15,23,42,0.05))] sm:border lg:min-h-0 lg:flex-1">
            <div className="px-1 py-2 sm:px-3 sm:py-4 lg:px-4 lg:py-4 xl:px-5">
              <CvPreviewStage cv={previewData} template={template} />
            </div>
          </ScrollArea>
        </div>

        {isEditorOpen && (
          <div className="order-2 min-h-0 lg:order-1 lg:min-w-0">
            <ScrollArea className="lg:h-full">
              <div className="pr-0 lg:pr-3">
                <CvEditorForm value={data} onChange={setData} />
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  )
}
