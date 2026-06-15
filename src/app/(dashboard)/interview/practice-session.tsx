"use client"

import { useMemo, useState } from "react"
import { ArrowRight, Eye, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { InterviewWorkspaceData } from "./data"

export function PracticeSession({
  questions,
  answers,
}: Pick<InterviewWorkspaceData, "questions" | "answers">) {
  const available = useMemo(
    () => questions.filter((question) => question.id),
    [questions],
  )
  const [index, setIndex] = useState(0)
  const [response, setResponse] = useState("")
  const [revealed, setRevealed] = useState(false)
  const question = available[index % Math.max(available.length, 1)]
  const savedAnswer = answers.find(
    (answer) =>
      answer.questionId === question?.id &&
      answer.applicationId === null &&
      answer.status === "saved",
  )

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
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="border border-border bg-card p-5 md:p-7">
        <p className="page-kicker">
          Question {(index % available.length) + 1} of {available.length}
        </p>
        <h2 className="mt-4 font-heading text-[1.8rem] leading-tight">
          {question.text}
        </h2>
        <textarea
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          rows={12}
          placeholder="Type the answer you would give aloud. Aim for clear, natural language rather than memorising every word."
          className="mt-6 w-full resize-y border border-border bg-background px-4 py-3 text-sm leading-7 outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
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
            }}
          >
            <RotateCcw className="mr-1.5 size-4" />
            Reset
          </Button>
        </div>
      </section>

      <aside className="border border-border bg-secondary/25 p-5 md:p-7">
        <p className="page-kicker">Coach&apos;s check</p>
        {revealed && savedAnswer ? (
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
          </div>
        )}
      </aside>
    </div>
  )
}
