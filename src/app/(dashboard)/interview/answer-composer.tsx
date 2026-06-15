"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Loader2, Save, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { createQuestion, saveAnswer } from "./actions"
import { EvidenceDiscovery } from "./evidence-discovery"
import type {
  EvidenceSnapshot,
  InterviewAnswerView,
  InterviewQuestionView,
} from "./data"

export function AnswerComposer({
  question,
  answers,
  applications,
  onQuestionPersisted,
}: {
  question: InterviewQuestionView
  answers: InterviewAnswerView[]
  applications: Array<{ id: string; title: string; company: string }>
  onQuestionPersisted: (key: string, id: string) => void
}) {
  const [applicationId, setApplicationId] = useState("")
  const saved = useMemo(
    () =>
      answers.find(
        (answer) =>
          answer.questionId === question.id &&
          (answer.applicationId ?? "") === applicationId &&
          answer.status === "saved",
      ),
    [answers, applicationId, question.id],
  )
  const [content, setContent] = useState(saved?.content ?? "")
  const [evidence, setEvidence] = useState<EvidenceSnapshot | null>(
    saved?.evidenceSnapshot ?? null,
  )
  const [discovery, setDiscovery] = useState<{
    questionId: string
    prompts: string[]
  } | null>(null)
  const [error, setError] = useState("")
  const [generating, setGenerating] = useState(false)
  const [saving, startSaving] = useTransition()

  useEffect(() => {
    setContent(saved?.content ?? "")
    setEvidence(saved?.evidenceSnapshot ?? null)
    setDiscovery(null)
    setError("")
  }, [saved, question.key, applicationId])

  async function ensureQuestionId(): Promise<string | null> {
    if (question.id) return question.id
    const result = await createQuestion({
      text: question.text,
      category: question.category,
      sourceType: "built_in",
      sourceRef: question.sourceRef,
    })
    if ("error" in result) {
      setError(result.error)
      return null
    }
    onQuestionPersisted(question.key, result.id)
    return result.id
  }

  async function generate() {
    setGenerating(true)
    setError("")
    setDiscovery(null)
    const questionId = await ensureQuestionId()
    if (!questionId) {
      setGenerating(false)
      return
    }

    try {
      const response = await fetch("/api/interview/answers/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          questionId,
          applicationId: applicationId || null,
        }),
      })
      const payload = await response.json()
      if (response.status === 409 && payload.status === "needs_evidence") {
        setDiscovery({
          questionId,
          prompts: payload.suggestedPrompts,
        })
        return
      }
      if (!response.ok) throw new Error(payload.error || "Generation failed")
      setContent(payload.content)
      setEvidence(payload.evidenceSnapshot)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Generation failed",
      )
    } finally {
      setGenerating(false)
    }
  }

  function save() {
    startSaving(async () => {
      setError("")
      const questionId = await ensureQuestionId()
      if (!questionId || !evidence) return
      const result = await saveAnswer({
        questionId,
        applicationId: applicationId || null,
        content,
        evidenceSnapshot: evidence,
      })
      if ("error" in result) {
        setError(result.error)
        return
      }
      window.location.reload()
    })
  }

  return (
    <section className="min-w-0 border border-border bg-card">
      <div className="border-b border-border p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{question.category}</Badge>
          <Badge variant="ghost">
            {question.requiresStory ? "Story required" : "Profile answer"}
          </Badge>
          {saved?.evidenceStale && (
            <Badge variant="destructive">Evidence changed</Badge>
          )}
        </div>
        <h2 className="mt-4 font-heading text-[1.65rem] leading-tight tracking-[-0.03em]">
          {question.text}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Generate a complete example from confirmed information, then edit it
          until it sounds like you.
        </p>
      </div>

      <div className="space-y-5 p-5 md:p-6">
        <div className="space-y-1.5">
          <label
            htmlFor="interview-application"
            className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground"
          >
            Version
          </label>
          <select
            id="interview-application"
            value={applicationId}
            onChange={(event) => setApplicationId(event.target.value)}
            className="h-10 w-full border border-border bg-background px-3 text-sm"
          >
            <option value="">General answer</option>
            {applications.map((application) => (
              <option key={application.id} value={application.id}>
                {application.title} at {application.company}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Job versions are saved separately from your reusable general answer.
          </p>
        </div>

        {discovery ? (
          <EvidenceDiscovery
            questionId={discovery.questionId}
            prompts={discovery.prompts}
            onConfirmed={() => {
              setDiscovery(null)
              void generate()
            }}
          />
        ) : (
          <>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={14}
              placeholder="Your full answer will appear here. You can also write your own answer from scratch."
              className="w-full resize-y border border-border bg-background/70 px-4 py-3 text-sm leading-7 outline-none focus:ring-1 focus:ring-ring"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={generate} disabled={generating}>
                {generating ? (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 size-4" />
                )}
                {content ? "Generate another draft" : "Generate full example"}
              </Button>
              <Button
                variant="outline"
                onClick={save}
                disabled={saving || !content.trim() || !evidence}
              >
                <Save className="mr-1.5 size-4" />
                {saving ? "Saving..." : "Save answer"}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
