"use client"

import { useState } from "react"
import { ArrowRight, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { confirmDiscoveredStory } from "./actions"
import type { DiscoveryDraft } from "@/lib/interview/parse-generation"

export function EvidenceDiscovery({
  questionId,
  prompts,
  onConfirmed,
}: {
  questionId: string
  prompts: string[]
  onConfirmed: () => void
}) {
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState("")
  const [responses, setResponses] = useState<
    Array<{ prompt: string; answer: string }>
  >([])
  const [draft, setDraft] = useState<DiscoveryDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function continueDiscovery() {
    const next = [
      ...responses,
      { prompt: prompts[index], answer: answer.trim() },
    ]
    if (index < prompts.length - 1) {
      setResponses(next)
      setAnswer("")
      setIndex(index + 1)
      return
    }

    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/interview/discovery/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionId, responses: next }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || "Discovery failed")
      setDraft(payload)
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Discovery failed",
      )
    } finally {
      setLoading(false)
    }
  }

  async function confirmStory() {
    if (!draft || draft.outcome !== "story_found") return
    setLoading(true)
    const result = await confirmDiscoveredStory(draft.story)
    setLoading(false)
    if ("error" in result) {
      setError(result.error)
      return
    }
    onConfirmed()
  }

  if (draft?.outcome === "story_found") {
    return (
      <div className="space-y-4 border border-border bg-secondary/25 p-5">
        <div>
          <p className="page-kicker">Review before saving</p>
          <h3 className="mt-2 font-heading text-xl">{draft.story.title}</h3>
        </div>
        {(["situation", "task", "action", "result"] as const).map((field) => (
          <div key={field}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {field}
            </p>
            <p className="mt-1 text-sm leading-relaxed">
              {draft.story[field] || "Not enough detail yet."}
            </p>
          </div>
        ))}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={confirmStory} disabled={loading}>
          <Check className="mr-1.5 size-4" />
          Confirm this is accurate
        </Button>
      </div>
    )
  }

  if (draft) {
    return (
      <div className="space-y-3 border border-border bg-secondary/25 p-5">
        <p className="text-sm font-semibold">
          {draft.outcome === "no_example"
            ? "You do not need to invent a story."
            : "There is useful evidence, but not a complete story yet."}
        </p>
        <p className="text-sm leading-relaxed">
          {draft.honestAnswer}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {draft.outcome === "no_example"
            ? draft.hypotheticalApproach
            : draft.limitations}
        </p>
      </div>
    )
  }

  return (
    <div className="border border-border bg-secondary/25 p-5">
      <p className="page-kicker">
        Find a real example {index + 1}/{prompts.length}
      </p>
      <p className="mt-3 font-heading text-xl leading-snug">{prompts[index]}</p>
      <textarea
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        rows={5}
        placeholder="Write what you remember. It can be from university, work, volunteering, a personal project, relocation, or your job search."
        className="mt-4 w-full resize-y border border-border bg-background px-3 py-3 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-ring"
      />
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <Button
        className="mt-3"
        onClick={continueDiscovery}
        disabled={!answer.trim() || loading}
      >
        {loading ? (
          <Loader2 className="mr-1.5 size-4 animate-spin" />
        ) : (
          <ArrowRight className="mr-1.5 size-4" />
        )}
        {index < prompts.length - 1 ? "Next prompt" : "Review what I have"}
      </Button>
    </div>
  )
}
