"use client"

import { useMemo, useState } from "react"
import { ArrowRight, Eye, Loader2, RotateCcw, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MarkdownContent } from "@/components/ui/markdown-content"
import type { InterviewWorkspaceData } from "./data"

export function PracticeSession({
  questions,
  answers,
  applications,
  applicationId,
}: Pick<InterviewWorkspaceData, "questions" | "answers" | "applications"> & {
  applicationId: string
}) {
  const available = useMemo(
    () => questions.filter((question) => question.id),
    [questions],
  )
  const [index, setIndex] = useState(0)
  const [response, setResponse] = useState("")
  const [revealed, setRevealed] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [error, setError] = useState("")
  const [evaluating, setEvaluating] = useState(false)
  const question = available[index % Math.max(available.length, 1)]
  const selectedApplication = applications.find((application) => application.id === applicationId)
  const savedAnswer = answers.find(
    (answer) =>
      answer.questionId === question?.id &&
      (answer.applicationId ?? "") === applicationId &&
      answer.status === "saved",
  )
  const wordCount = response.trim().split(/\s+/).filter(Boolean).length

  if (!question) {
    return (
      <div className="border border-border bg-card p-10 text-center">
        <p className="font-heading text-2xl">Choose a question first.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Open Questions and generate or save one answer to begin practice.
        </p>
      </div>
    )
  }

  function next() {
    setIndex((current) => (current + 1) % available.length)
    setResponse("")
    setRevealed(false)
    setFeedback("")
    setError("")
  }

  async function evaluate() {
    if (!question?.id || !response.trim()) return
    setEvaluating(true)
    setFeedback("")
    setError("")
    try {
      const result = await fetch("/api/interview/practice/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          applicationId: applicationId || null,
          answer: response,
        }),
      })
      const payload = await result.json() as { feedback?: string; error?: string }
      if (!result.ok) throw new Error(payload.error ?? "Evaluation failed")
      setFeedback(payload.feedback ?? "")
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Evaluation failed")
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(300px,0.92fr)]">
      <section className="border border-border bg-card/95 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.07)] md:p-7">
        <p className="page-kicker">
          {selectedApplication
            ? `Grill Me: ${selectedApplication.company}`
            : "Grill Me: General prep"} · Question {(index % available.length) + 1} of {available.length}
        </p>
        <h2 className="mt-4 font-heading text-[1.8rem] leading-tight">
          {question.text}
        </h2>
        <textarea
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          rows={12}
          placeholder="Type the answer you would give aloud. Aim for clear, natural language rather than memorising every word."
          className="mt-6 w-full resize-y border border-border bg-background px-4 py-3.5 text-sm leading-7 outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/25 focus:ring-1 focus:ring-ring"
        />
        <p className="mt-2 text-xs text-muted-foreground">{wordCount} words</p>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={evaluate}
            disabled={evaluating || !response.trim()}
          >
            {evaluating ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Zap className="mr-1.5 size-4" />
            )}
            {evaluating ? "Evaluating..." : "Evaluate my answer"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setRevealed(true)}
            disabled={!savedAnswer}
          >
            <Eye className="mr-1.5 size-4" />
            Compare with saved answer
          </Button>
          <Button variant="outline" onClick={next}>
            Next question
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setResponse("")
              setRevealed(false)
              setFeedback("")
              setError("")
            }}
          >
            <RotateCcw className="mr-1.5 size-4" />
            Reset
          </Button>
        </div>
      </section>

      <aside className="border border-border bg-secondary/20 p-5 md:p-7">
        <p className="page-kicker">Coach&apos;s check</p>
        {feedback ? (
          <div className="mt-4 border border-border bg-card p-4">
            <MarkdownContent content={feedback} />
          </div>
        ) : revealed && savedAnswer ? (
          <>
            <h3 className="mt-3 font-heading text-xl">Your saved version</h3>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7">
              {savedAnswer.content}
            </p>
          </>
        ) : (
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>Before comparing, check your own answer:</p>
            <p>Did you answer the exact question in the first few sentences?</p>
            <p>For examples, did you explain what you personally did?</p>
            <p>Did you finish with a concrete result or lesson?</p>
            {!savedAnswer && (
              <p className="text-foreground">
                Save an answer for this context to enable side-by-side comparison.
              </p>
            )}
          </div>
        )}
      </aside>
    </div>
  )
}
