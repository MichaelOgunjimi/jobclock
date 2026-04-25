"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, BookOpen, Building2, Loader2, RefreshCw, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-styles"
import { MarkdownContent } from "@/components/ui/markdown-content"
import { cn } from "@/lib/utils"

type Tab = "prep" | "research"

export default function InterviewPrepPage() {
  const params = useParams()
  const applicationId = params.id as string

  const [tab, setTab] = useState<Tab>("prep")
  const [prepContent, setPrepContent] = useState<string | null>(null)
  const [researchContent, setResearchContent] = useState<string | null>(null)
  const [loadingPrep, setLoadingPrep] = useState(false)
  const [loadingResearch, setLoadingResearch] = useState(false)
  const [prepError, setPrepError] = useState<string | null>(null)
  const [researchError, setResearchError] = useState<string | null>(null)
  const [storyCount, setStoryCount] = useState<number | null>(null)

  useEffect(() => {
    async function loadSaved() {
      setLoadingPrep(true)
      try {
        const [prepRes, researchRes] = await Promise.all([
          fetch(`/api/applications/${applicationId}/interview`),
          fetch(`/api/applications/${applicationId}/company-research`),
        ])
        const prepData = await prepRes.json() as { content: string | null; storyCount?: number }
        const researchData = await researchRes.json() as { content: string | null }
        if (prepData.content) setPrepContent(prepData.content)
        if (prepData.storyCount !== undefined) setStoryCount(prepData.storyCount)
        if (researchData.content) setResearchContent(researchData.content)
      } finally {
        setLoadingPrep(false)
      }
    }
    void loadSaved()
  }, [applicationId])

  async function generatePrep() {
    setLoadingPrep(true)
    setPrepError(null)
    try {
      const res = await fetch(`/api/applications/${applicationId}/interview`, { method: "POST" })
      const data = await res.json() as { content?: string; error?: string; storyCount?: number }
      if (!res.ok) throw new Error(data.error ?? "Failed to generate interview prep")
      setPrepContent(data.content ?? null)
      if (data.storyCount !== undefined) setStoryCount(data.storyCount)
    } catch (err) {
      setPrepError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoadingPrep(false)
    }
  }

  async function generateResearch() {
    setLoadingResearch(true)
    setResearchError(null)
    try {
      const res = await fetch(`/api/applications/${applicationId}/company-research`, { method: "POST" })
      const data = await res.json() as { content?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to run company research")
      setResearchContent(data.content ?? null)
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoadingResearch(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <Link
          href={`/applications/${applicationId}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
        <h1 className="font-heading text-2xl tracking-tight">Interview Preparation</h1>
      </div>

      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setTab("prep")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "prep"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="inline h-3.5 w-3.5 mr-1.5" />
          Interview Prep
        </button>
        <button
          type="button"
          onClick={() => setTab("research")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "research"
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Building2 className="inline h-3.5 w-3.5 mr-1.5" />
          Company Research
        </button>
      </div>

      {tab === "prep" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button onClick={() => void generatePrep()} disabled={loadingPrep}>
              {loadingPrep ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {prepContent ? "Regenerate" : "Generate Interview Prep"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Uses the job description + your story bank. Saved automatically.
            </p>
          </div>

          {storyCount === 0 && (
            <div className="flex items-start gap-3 border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Your story bank was empty when this was generated — all questions show "Best story: —".{" "}
                <Link href="/interview" className="underline underline-offset-2 hover:opacity-70">
                  Add STAR stories
                </Link>{" "}
                then regenerate for matched answers.
              </span>
            </div>
          )}

          {prepError && (
            <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {prepError}
            </div>
          )}

          {prepContent && (
            <div className="border bg-card p-6">
              <MarkdownContent content={prepContent} />
            </div>
          )}

          {!prepContent && !loadingPrep && !prepError && (
            <div className="border bg-secondary px-6 py-14 text-center text-muted-foreground">
              <BookOpen className="mx-auto mb-4 h-10 w-10 opacity-30" />
              <p className="font-medium text-foreground">No prep generated yet</p>
              <p className="mt-2 text-sm">Hit "Generate" to get a tailored interview plan based on the job description and your story bank.</p>
            </div>
          )}
        </div>
      )}

      {tab === "research" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button onClick={() => void generateResearch()} disabled={loadingResearch}>
              {loadingResearch ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {researchContent ? "Re-research" : "Research Company"}
            </Button>
            <p className="text-sm text-muted-foreground">
              6-axis company intelligence — uses Perplexity (live web) if configured, otherwise your AI model. Saved automatically.
            </p>
          </div>

          {researchError && (
            <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {researchError}
            </div>
          )}

          {researchContent && (
            <div className="border bg-card p-6">
              <MarkdownContent content={researchContent} />
            </div>
          )}

          {!researchContent && !loadingResearch && !researchError && (
            <div className="border bg-secondary px-6 py-14 text-center text-muted-foreground">
              <Building2 className="mx-auto mb-4 h-10 w-10 opacity-30" />
              <p className="font-medium text-foreground">No research yet</p>
              <p className="mt-2 text-sm">
                Covers AI/product strategy, recent news, engineering culture, competitive landscape, and your personal angle.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
