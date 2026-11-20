"use client"

import { useState, useTransition } from "react"
import { RefreshCw, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { CvData } from "@/lib/supabase/database.types"
import { normalizeCvData, sanitizeCvData, type NormalizedCvData } from "@/lib/cv-data"
import { parseReviewFindings, type CvReviewFinding } from "@/lib/ai/cv-review-schemas"
import { findingKey, getFindingText, setFindingText } from "@/lib/cv/review-location"
import { CvEditorForm } from "@/components/cv/editor/cv-editor-form"
import { CvReviewFindings } from "@/components/cv/cv-review-findings"
import { saveCvData, renameCv } from "../actions"

export function CvEditor({
  cvId,
  cvName,
  initialData,
  initialFindings,
  recheckCredits,
}: {
  cvId: string
  cvName: string
  initialData: CvData
  initialFindings: CvReviewFinding[]
  /** Credits a re-check costs on JobClock AI. */
  recheckCredits: number
}) {
  const [data, setData] = useState<NormalizedCvData>(() => normalizeCvData(initialData))
  const [name, setName] = useState(cvName)
  const [savedName, setSavedName] = useState(cvName)
  const [isPending, startTransition] = useTransition()
  const [findings, setFindings] = useState(initialFindings)
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())
  const [checking, setChecking] = useState(false)
  const [lastCheck, setLastCheck] = useState<{ resolved: number; added: number } | null>(null)

  // A finding is "addressed" once the text it pointed at has changed; only a re-check can confirm it is really fixed.
  const undismissed = findings.filter((f) => !dismissed.has(findingKey(f)))
  const open = undismissed.filter((f) => f.original === undefined || getFindingText(data, f.location) === f.original)
  const addressed = undismissed.length - open.length
  const highCount = open.filter((f) => f.severity === "high").length

  async function persist(): Promise<boolean> {
    if (name !== savedName) {
      const formData = new FormData()
      formData.append("cvId", cvId)
      formData.append("name", name)
      await renameCv(formData)
      setSavedName(name)
    }
    // Save the cleaned CV and show it, so bullet positions match what the review will see.
    const clean = sanitizeCvData(data)
    const result = await saveCvData(cvId, clean)
    if (result?.error) {
      toast.error(result.error)
      return false
    }
    setData(clean)
    return true
  }

  function handleSave() {
    startTransition(async () => {
      if (await persist()) toast.success("CV saved")
    })
  }

  function handleApply(finding: CvReviewFinding, text: string) {
    const next = setFindingText(data, finding.location, text)
    if (!next) {
      toast.error("That part of the CV has changed. Re-check to refresh the findings.")
      return
    }
    setData(next)
    toast.success("Applied to your CV. Save to keep it, or re-check to confirm.")
  }

  async function handleRecheck() {
    setChecking(true)
    try {
      if (!(await persist())) return
      const response = await fetch(`/api/cv/${cvId}/review`, { method: "POST" })
      const body = (await response.json().catch(() => null)) as { findings?: unknown; error?: string } | null
      if (!response.ok) {
        toast.error(body?.error ?? "Re-check failed. Please try again.")
        return
      }
      const next = parseReviewFindings(body?.findings)
      const previous = new Set(findings.map(findingKey))
      const current = new Set(next.map(findingKey))
      setLastCheck({
        resolved: undismissed.filter((f) => !current.has(findingKey(f))).length,
        added: next.filter((f) => !previous.has(findingKey(f))).length,
      })
      setFindings(next)
    } catch {
      toast.error("Re-check failed. Please try again.")
    } finally {
      setChecking(false)
    }
  }

  return (
    <>
      <section className="mb-8 space-y-3" aria-labelledby="cv-review-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2
              id="cv-review-heading"
              className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              Content review
            </h2>
            <p className="text-[13px] tabular-nums text-foreground" role="status">
              {open.length === 0
                ? "No open findings"
                : `${open.length} open ${open.length === 1 ? "finding" : "findings"}${highCount ? `, ${highCount} high` : ""}`}
              {addressed > 0 && (
                <span className="text-muted-foreground">
                  {" "}· {addressed} of {undismissed.length} addressed. Re-check to confirm.
                </span>
              )}
              {lastCheck && (
                <span className="text-muted-foreground">
                  {" "}· Last check: {lastCheck.resolved} resolved, {lastCheck.added} new
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button variant="outline" size="sm" onClick={handleRecheck} disabled={checking || isPending}>
              <RefreshCw className={checking ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              {checking ? "Re-checking…" : "Re-check"}
            </Button>
            <span className="text-[11px] text-muted-foreground">
              Uses AI · {recheckCredits} credits on JobClock AI · saves your edits first
            </span>
          </div>
        </div>
        <CvReviewFindings
          findings={open}
          onApply={handleApply}
          onDismiss={(finding) => setDismissed((prev) => new Set(prev).add(findingKey(finding)))}
        />
      </section>

      <CvEditorForm
        value={data}
        onChange={setData}
        documentName={name}
        onDocumentNameChange={setName}
        footer={
          <div className="flex justify-end pb-8">
            <Button onClick={handleSave} disabled={isPending || checking} size="lg">
              <Save className="h-4 w-4" />
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        }
      />
    </>
  )
}
