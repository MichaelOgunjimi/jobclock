"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Check, Loader2, Save, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { confirmProfileFacts, createQuestion, saveAnswer } from "./actions"
import { EvidenceDiscovery } from "./evidence-discovery"
import type {
  ApplicationCvFactDraftGroup,
  EvidenceSnapshot,
  InterviewAnswerView,
  InterviewProfileFactView,
  InterviewQuestionView,
  ProfileFactDraft,
} from "./data"

function TailoredCvFactSuggestions({
  applicationId,
  facts,
  groups,
}: {
  applicationId: string
  facts: InterviewProfileFactView[]
  groups: ApplicationCvFactDraftGroup[]
}) {
  const group = groups.find((item) => item.applicationId === applicationId)
  const confirmedSourceRefs = new Set(
    facts.map((fact) => fact.sourceRef).filter(Boolean),
  )
  const suggestions =
    group?.facts.filter((draft) => !confirmedSourceRefs.has(draft.sourceRef)) ??
    []
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(
    () => new Set(suggestions.map((draft) => draft.sourceRef)),
  )
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  if (!group || suggestions.length === 0) return null

  function toggle(draft: ProfileFactDraft) {
    setSelectedRefs((current) => {
      const next = new Set(current)
      if (next.has(draft.sourceRef)) {
        next.delete(draft.sourceRef)
      } else {
        next.add(draft.sourceRef)
      }
      return next
    })
  }

  function confirmSelected() {
    startTransition(async () => {
      setError("")
      const result = await confirmProfileFacts(
        [...selectedRefs].map((sourceRef) => ({ sourceRef })),
      )
      if ("error" in result) {
        setError(result.error)
        return
      }
      window.location.reload()
    })
  }

  return (
    <div className="border border-border bg-secondary/25 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Suggested from this tailored CV</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Confirm only the points that are accurate. Confirmed facts can be
            used when generating this job version.
          </p>
        </div>
        <Badge variant="ghost">
          {new Date(group.generatedAt).toLocaleDateString("en-GB")}
        </Badge>
      </div>
      <div className="mt-4 space-y-2">
        {suggestions.slice(0, 8).map((draft) => (
          <label
            key={draft.sourceRef}
            className="flex cursor-pointer gap-3 border border-border bg-background/70 p-3"
          >
            <input
              type="checkbox"
              checked={selectedRefs.has(draft.sourceRef)}
              onChange={() => toggle(draft)}
              className="mt-1 size-4"
            />
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {draft.category}
              </span>
              <span className="mt-0.5 block text-sm font-medium">
                {draft.label}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {draft.detail}
              </span>
            </span>
          </label>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <Button
        className="mt-4"
        size="sm"
        onClick={confirmSelected}
        disabled={pending || selectedRefs.size === 0}
      >
        <Check className="mr-1.5 size-4" />
        {pending ? "Confirming..." : "Confirm selected facts"}
      </Button>
    </div>
  )
}

export function AnswerComposer({
  question,
  answers,
  applications,
  applicationId,
  facts,
  applicationCvFactDrafts,
  onQuestionPersisted,
}: {
  question: InterviewQuestionView
  answers: InterviewAnswerView[]
  applications: Array<{ id: string; title: string; company: string }>
  applicationId: string
  facts: InterviewProfileFactView[]
  applicationCvFactDrafts: ApplicationCvFactDraftGroup[]
  onQuestionPersisted: (key: string, id: string) => void
}) {
  const selectedApplication = applications.find((application) => application.id === applicationId)
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
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={selectedApplication ? "outline" : "default"}>
            {selectedApplication
              ? `${selectedApplication.title} at ${selectedApplication.company}`
              : "General answer"}
          </Badge>
          <p className="text-xs text-muted-foreground">
            Job versions are saved separately from your reusable general answer.
          </p>
        </div>

        {applicationId && (
          <TailoredCvFactSuggestions
            key={applicationId}
            applicationId={applicationId}
            facts={facts}
            groups={applicationCvFactDrafts}
          />
        )}

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
