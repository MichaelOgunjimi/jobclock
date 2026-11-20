"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownContent } from "@/components/ui/markdown-content"
import { GenerationProgress } from "@/components/generation-progress"
import { useGenerationJobsContext } from "@/contexts/generation-jobs-context"
import { cn } from "@/lib/utils"

/**
 * Company research lives in interview_prep.research_content as a markdown
 * string (## sections with bullet lists). Generation is a background job,
 * tracked the same way as the CV and cover letter cards.
 */
export function CompanyResearchCard({
  applicationId,
  content,
}: {
  applicationId: string
  content: string | null
}) {
  const { getActiveJob, trackJob } = useGenerationJobsContext()
  const router = useRouter()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const activeJob = getActiveJob(applicationId, "company_research")
  const prevActiveJobIdRef = useRef<string | undefined>(undefined)

  // Refetch the server-loaded content when a job finishes.
  useEffect(() => {
    if (activeJob) {
      prevActiveJobIdRef.current = activeJob.id
    } else if (prevActiveJobIdRef.current !== undefined) {
      prevActiveJobIdRef.current = undefined
      router.refresh()
    }
  }, [activeJob, router])

  async function handleGenerate() {
    setError(null)
    setStarting(true)
    try {
      const res = await fetch(`/api/applications/${applicationId}/company-research`, { method: "POST" })
      const data = await res.json().catch(() => ({})) as { jobId?: string; error?: string }
      if (!res.ok) {
        setError(data.error ?? "Failed to start company research.")
      } else if (data.jobId) {
        trackJob({ id: data.jobId, applicationId, kind: "company_research" })
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setStarting(false)
    }
  }

  const hasContent = !!content?.trim()

  return (
    <Card id="company-research" className="scroll-mt-6">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          Company research
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        {!hasContent && !activeJob && (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Products, recent moves, culture and likely challenges, so you walk into the interview prepared.
          </p>
        )}

        {!activeJob && (
          <Button
            type="button"
            size="sm"
            variant={hasContent ? "outline" : "default"}
            disabled={starting}
            onClick={handleGenerate}
            className="w-full sm:w-auto"
          >
            {starting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Starting…
              </>
            ) : hasContent ? (
              "Regenerate research"
            ) : (
              "Generate company research"
            )}
          </Button>
        )}

        {activeJob && <GenerationProgress label="company research" startedAt={activeJob.created_at} />}

        {error && <p className="text-[12px] text-destructive">{error}</p>}

        {hasContent && (
          <div className="space-y-2">
            <div
              className={cn(
                "break-words border bg-secondary/40 px-4 py-3 [&_a]:break-all [&_table]:block [&_table]:overflow-x-auto",
                !expanded && "max-h-80 overflow-hidden",
              )}
            >
              <MarkdownContent content={content!} />
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="w-full sm:w-auto"
            >
              {expanded ? "Show less" : "Show full research"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
