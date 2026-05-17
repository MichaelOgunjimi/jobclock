"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, BookOpen, Building2, ChevronLeft, ChevronRight, Loader2, RefreshCw, AlertTriangle, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-styles"
import { MarkdownContent } from "@/components/ui/markdown-content"
import { cn } from "@/lib/utils"

type Tab = "prep" | "research" | "grill"

function GrillMe({
  applicationId,
  questions,
}: {
  applicationId: string
  questions: string[]
}) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answer, setAnswer] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const question = questions[currentIdx] ?? null

  function handleNext() {
    setCurrentIdx((i) => Math.min(i + 1, questions.length - 1))
    setAnswer("")
    setFeedback(null)
    setError(null)
  }

  function handlePrev() {
    setCurrentIdx((i) => Math.max(i - 1, 0))
    setAnswer("")
    setFeedback(null)
    setError(null)
  }

  async function handleEvaluate() {
    if (!answer.trim() || !question) return
    setLoading(true)
    setFeedback(null)
    setError(null)
    try {
      const res = await fetch(`/api/applications/${applicationId}/interview/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer }),
      })
      const data = await res.json() as { feedback?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Evaluation failed")
      setFeedback(data.feedback ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (questions.length === 0) {
    return (
      <div className="border bg-secondary px-6 py-14 text-center text-muted-foreground">
        <Zap className="mx-auto mb-4 h-10 w-10 opacity-30" />
        <p className="font-medium text-foreground">No questions yet</p>
        <p className="mt-2 text-sm">Generate your interview prep first — then come back to practice.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Question navigator */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIdx === 0}
          className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm text-muted-foreground">
          Question {currentIdx + 1} of {questions.length}
        </span>
        <button
          type="button"
          onClick={handleNext}
          disabled={currentIdx === questions.length - 1}
          className="flex h-8 w-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Question card */}
      <div className="border border-border bg-secondary px-5 py-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Question</p>
        <p className="font-medium leading-relaxed">{question?.replace(/^\*\*Q\d+\.\*\*\s*/, "")}</p>
      </div>

      {/* Answer area */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Your answer</label>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Speak or type your answer here. Aim for 2–3 minutes worth of content (roughly 300–400 words). Use the STAR structure: Situation → Task → Action → Result."
          rows={8}
          className="w-full resize-y border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">{answer.trim().split(/\s+/).filter(Boolean).length} words</p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleEvaluate} disabled={loading || !answer.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {loading ? "Evaluating…" : "Evaluate my answer"}
        </Button>
        {feedback && (
          <Button variant="outline" onClick={() => { setAnswer(""); setFeedback(null) }}>
            Try again
          </Button>
        )}
      </div>

      {error && (
        <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {feedback && (
        <div className="border border-border bg-card p-6">
          <MarkdownContent content={feedback} />
          <div className="mt-6 pt-4 border-t border-border">
            <Button variant="outline" onClick={handleNext} disabled={currentIdx === questions.length - 1}>
              Next question <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function InterviewPrepPage() {
  const params = useParams()
  const applicationId = params.id as string

  const [tab, setTab] = useState<Tab>("prep")
  const [prepContent, setPrepContent] = useState<string | null>(null)
  const [researchContent, setResearchContent] = useState<string | null>(null)
  const [questions, setQuestions] = useState<string[]>([])
  const [loadingPrep, setLoadingPrep] = useState(false)
  const [loadingResearch, setLoadingResearch] = useState(false)
  const [prepError, setPrepError] = useState<string | null>(null)
  const [researchError, setResearchError] = useState<string | null>(null)
  // TODO(module-4): replace with Realtime-driven state + toast
  const [prepPending, setPrepPending] = useState(false)
  // TODO(module-4): replace with Realtime-driven state + toast
  const [researchPending, setResearchPending] = useState(false)
  const [storyCount, setStoryCount] = useState<number | null>(null)

  useEffect(() => {
    async function loadSaved() {
      setLoadingPrep(true)
      try {
        const [prepRes, researchRes] = await Promise.all([
          fetch(`/api/applications/${applicationId}/interview`),
          fetch(`/api/applications/${applicationId}/company-research`),
        ])
        const prepData = await prepRes.json() as { content: string | null; questions?: string[]; storyCount?: number }
        const researchData = await researchRes.json() as { content: string | null }
        if (prepData.content) setPrepContent(prepData.content)
        if (prepData.questions) setQuestions(prepData.questions)
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
    setPrepPending(false)
    try {
      const res = await fetch(`/api/applications/${applicationId}/interview`, { method: "POST" })
      const data = await res.json() as { jobId?: string; deduped?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to start interview prep generation")
      setPrepPending(true)
    } catch (err) {
      setPrepError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoadingPrep(false)
    }
  }

  async function generateResearch() {
    setLoadingResearch(true)
    setResearchError(null)
    setResearchPending(false)
    try {
      const res = await fetch(`/api/applications/${applicationId}/company-research`, { method: "POST" })
      const data = await res.json() as { jobId?: string; deduped?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Failed to start company research")
      setResearchPending(true)
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
        {(["prep", "research", "grill"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "prep" && <BookOpen className="h-3.5 w-3.5" />}
            {t === "research" && <Building2 className="h-3.5 w-3.5" />}
            {t === "grill" && <Zap className="h-3.5 w-3.5" />}
            {t === "prep" ? "Interview Prep" : t === "research" ? "Company Research" : "Grill Me"}
          </button>
        ))}
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
                Your story bank was empty when this was generated — all questions show &quot;Best story: —&quot;.{" "}
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

          {prepPending && (
            <div className="border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
              Generating in the background — this can take a minute; reload to see it once it&apos;s ready.
            </div>
          )}

          {prepContent && (
            <div className="border bg-card p-6">
              <MarkdownContent content={prepContent} />
            </div>
          )}

          {!prepContent && !loadingPrep && !prepError && !prepPending && (
            <div className="border bg-secondary px-6 py-14 text-center text-muted-foreground">
              <BookOpen className="mx-auto mb-4 h-10 w-10 opacity-30" />
              <p className="font-medium text-foreground">No prep generated yet</p>
              <p className="mt-2 text-sm">Hit &quot;Generate&quot; to get a tailored interview plan based on the job description and your story bank.</p>
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

          {researchPending && (
            <div className="border border-border bg-secondary px-4 py-3 text-sm text-muted-foreground">
              Generating in the background — this can take a minute; reload to see it once it&apos;s ready.
            </div>
          )}

          {researchContent && (
            <div className="border bg-card p-6">
              <MarkdownContent content={researchContent} />
            </div>
          )}

          {!researchContent && !loadingResearch && !researchError && !researchPending && (
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

      {tab === "grill" && (
        <GrillMe applicationId={applicationId} questions={questions} />
      )}
    </div>
  )
}
