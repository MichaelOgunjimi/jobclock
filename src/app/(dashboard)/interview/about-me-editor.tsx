"use client"

import { useState, useTransition } from "react"
import { Pencil, Plus, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  confirmProfileFacts,
  createProfileFact,
  deleteProfileFact,
  updateProfileFact,
} from "./actions"
import type {
  InterviewWorkspaceData,
  ProfileFactDraft,
} from "./data"

function formatCategory(value: string) {
  return value.replace(/_/g, " ")
}

const categoryLabels: Record<string, string> = {
  activity: "Activities",
  achievement: "Achievements",
  certification: "Certifications",
  education: "Education",
  experience: "Experience",
  goals: "Goals",
  language: "Languages",
  personal_context: "Personal context",
  project: "Projects",
  skill: "Skills",
  strengths: "Strengths",
  summary: "Summary",
}

const categoryOrder = [
  "summary",
  "skill",
  "experience",
  "project",
  "education",
  "achievement",
  "certification",
  "activity",
  "language",
  "goals",
  "personal_context",
]

function categoryLabel(value: string) {
  return categoryLabels[value] ?? formatCategory(value)
}

function formatCvDate(value: string | null) {
  if (!value) return "Primary CV"
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function groupFactDrafts(drafts: ProfileFactDraft[]) {
  const grouped = drafts.reduce<Record<string, ProfileFactDraft[]>>((groups, draft) => {
    groups[draft.category] = [...(groups[draft.category] ?? []), draft]
    return groups
  }, {})

  return Object.entries(grouped).sort(([left], [right]) => {
    const leftIndex = categoryOrder.indexOf(left)
    const rightIndex = categoryOrder.indexOf(right)
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right)
    if (leftIndex === -1) return 1
    if (rightIndex === -1) return -1
    return leftIndex - rightIndex
  })
}

function FactRow({
  fact,
  onChanged,
}: {
  fact: InterviewWorkspaceData["facts"][number]
  onChanged: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(fact.label)
  const [detail, setDetail] = useState(fact.detail)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const result = await updateProfileFact(fact.id, {
        category: fact.category,
        label,
        detail,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      setEditing(false)
      onChanged()
    })
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteProfileFact(fact.id)
      if (result.error) {
        setError(result.error)
        return
      }
      onChanged()
    })
  }

  return (
    <article className="group border-b border-border bg-background/35 p-5 transition-colors last:border-b-0 hover:bg-background/60 md:p-6">
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_72px] lg:items-start">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {formatCategory(fact.category)}
          </p>
          {fact.isCurrentSource && (
            <span className="mt-2 inline-flex border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground">
              Current CV
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="space-y-3">
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                rows={4}
                className="w-full resize-y border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-ring"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={save}
                  disabled={pending || !label.trim() || !detail.trim()}
                >
                  Save changes
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-base font-semibold leading-snug">
                {fact.label}
              </p>
              <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">
                {fact.detail}
              </p>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex gap-3 lg:justify-end">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-muted-foreground hover:text-foreground"
              aria-label={`Edit ${fact.label}`}
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${fact.label}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

export function AboutMeEditor({
  facts,
  cvFactDrafts,
  applicationCvFactDrafts,
  applicationId,
  applications,
}: Pick<InterviewWorkspaceData, "facts" | "cvFactDrafts" | "applicationCvFactDrafts" | "applications"> & {
  applicationId: string
}) {
  const [category, setCategory] = useState("experience")
  const [label, setLabel] = useState("")
  const [detail, setDetail] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const categoryCounts = facts.reduce<Record<string, number>>((counts, fact) => {
    counts[fact.category] = (counts[fact.category] ?? 0) + 1
    return counts
  }, {})
  const topCategories = Object.entries(categoryCounts)
    .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
    .slice(0, 5)
  const selectedApplication = applications.find((application) => application.id === applicationId)
  const tailoredCvGroup =
    applicationId
      ? applicationCvFactDrafts.find((group) => group.applicationId === applicationId)
      : null
  const confirmedSourceRefs = new Set(
    facts.map((fact) => fact.sourceRef).filter(Boolean),
  )
  const suggestionSource: {
    title: string
    subtitle: string
    generatedAt: string | null
    customizedCvId: string | null
    drafts: ProfileFactDraft[]
  } = tailoredCvGroup
    ? {
        title: selectedApplication
          ? `${selectedApplication.title} at ${selectedApplication.company}`
          : "Selected tailored CV",
        subtitle: "Tailored CV suggestions grouped by section.",
        generatedAt: tailoredCvGroup.generatedAt,
        customizedCvId: tailoredCvGroup.customizedCvId,
        drafts: tailoredCvGroup.facts,
      }
    : {
        title: "Primary CV",
        subtitle: "General CV suggestions grouped by section.",
        generatedAt: null,
        customizedCvId: null,
        drafts: cvFactDrafts,
      }
  const pendingCvDrafts = suggestionSource.drafts.filter(
    (draft) => !confirmedSourceRefs.has(draft.sourceRef),
  )
  const groupedCvDrafts = groupFactDrafts(pendingCvDrafts)

  function addFact() {
    startTransition(async () => {
      setError("")
      const result = await createProfileFact({ category, label, detail })
      if ("error" in result) {
        setError(result.error)
        return
      }
      window.location.reload()
    })
  }

  function importCvFacts() {
    startTransition(async () => {
      const result = await confirmProfileFacts(
        pendingCvDrafts.map((draft) => ({ sourceRef: draft.sourceRef })),
      )
      if ("error" in result) {
        setError(result.error)
        return
      }
      window.location.reload()
    })
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden border border-border bg-card">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 border-l border-border/60 bg-[linear-gradient(135deg,transparent,rgba(255,255,255,0.04))] lg:block" />
        <div className="relative grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_420px] xl:p-7">
          <div className="max-w-4xl">
            <p className="page-kicker">Teach the assistant</p>
            <h2 className="mt-3 max-w-3xl font-heading text-[2.2rem] leading-[0.95] tracking-[-0.055em] md:text-[3rem] xl:text-[3.35rem]">
              Build the profile the answers should sound like.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              This is your interview memory. Confirm true facts, pull useful
              points from tailored CVs, then let answer generation reuse only the
              evidence you trust.
            </p>
            {topCategories.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {topCategories.map(([name, count]) => (
                  <span
                    key={name}
                    className="border border-border bg-background/60 px-3 py-1.5 text-xs font-medium capitalize text-muted-foreground"
                  >
                    {formatCategory(name)} · {count}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 border border-border bg-background/70 lg:grid-cols-1">
            <div className="border-r border-border p-4 lg:border-b lg:border-r-0 xl:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Confirmed facts
              </p>
              <p className="mt-2 font-heading text-4xl leading-none tracking-[-0.06em]">
                {facts.length}
              </p>
            </div>
            <div className="border-r border-border p-4 lg:border-b lg:border-r-0 xl:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Waiting from CV
              </p>
              <p className="mt-2 font-heading text-4xl leading-none tracking-[-0.06em]">
                {pendingCvDrafts.length}
              </p>
            </div>
            <div className="p-4 xl:p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Flow
              </p>
              <p className="mt-2 max-w-40 text-sm font-semibold leading-tight">
                Confirm, tailor, practise
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-6">
        <section className="overflow-hidden border border-border bg-card">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border p-5 md:p-6">
            <div>
              <p className="page-kicker">Confirmed memory</p>
              <h3 className="mt-2 font-heading text-2xl leading-none tracking-[-0.04em] md:text-3xl">
                What the assistant knows
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Edit this until it sounds like your real background. These facts
                are the reusable source material for interview answers.
              </p>
            </div>
            <p className="border border-border bg-background px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {facts.length} saved
            </p>
          </div>
          {facts.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-heading text-2xl">No profile facts yet.</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Add one manually or import from the current CV queue, then use it
                to generate stronger interview answers.
              </p>
            </div>
          ) : (
            <div>
              {facts.map((fact) => (
                <FactRow
                  key={fact.id}
                  fact={fact}
                  onChanged={() => window.location.reload()}
                />
              ))}
            </div>
          )}
        </section>

        <section className="border border-border bg-card">
          <div className="grid gap-6 p-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)] xl:p-6">
            <div>
              <p className="page-kicker">Add new evidence</p>
              <h3 className="mt-3 font-heading text-2xl leading-none tracking-[-0.04em] md:text-3xl">
                Teach it one true thing.
              </h3>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Use this for anything the assistant should remember exactly:
                education, projects, strengths, achievements, responsibilities,
                or useful context.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-11 w-full border border-border bg-background px-3 text-sm capitalize"
              >
                {[
                  "summary",
                  "education",
                  "experience",
                  "project",
                  "skill",
                  "achievement",
                  "strengths",
                  "goals",
                  "personal_context",
                ].map((value) => (
                  <option key={value} value={value}>
                    {formatCategory(value)}
                  </option>
                ))}
              </select>
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Short title, e.g. MSc Artificial Intelligence"
              />
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                rows={5}
                placeholder="Write the accurate detail you want interview answers to remember."
                className="w-full resize-y border border-border bg-background px-3 py-3 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-ring md:col-span-2"
              />
              <div className="md:col-span-2">
                {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
                <Button
                  onClick={addFact}
                  disabled={pending || !label.trim() || !detail.trim()}
                  className="h-11 justify-center"
                >
                  <Plus className="mr-1.5 size-4" />
                  Add confirmed fact
                </Button>
              </div>
            </div>
          </div>
        </section>

        {pendingCvDrafts.length > 0 && (
          <section className="overflow-hidden border border-border bg-card">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-background/30 p-5">
              <div>
                <p className="page-kicker">Review queue</p>
                <h3 className="mt-2 font-heading text-2xl leading-none tracking-[-0.04em]">
                  {tailoredCvGroup
                    ? "Suggested from this tailored CV"
                    : "Suggested from your CV"}
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {suggestionSource.subtitle} Add only what is accurate and
                  useful for interviews.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="border border-border bg-background px-2.5 py-1 font-semibold text-foreground">
                    {suggestionSource.title}
                  </span>
                  <span className="border border-border bg-background px-2.5 py-1">
                    CV date: {formatCvDate(suggestionSource.generatedAt)}
                  </span>
                  {suggestionSource.customizedCvId && (
                    <span className="border border-border bg-background px-2.5 py-1">
                      Tailored CV
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={importCvFacts}
                disabled={pending}
              >
                <Upload className="mr-1.5 size-3.5" />
                Add from current CV
              </Button>
            </div>
            <div className="divide-y divide-border">
              {groupedCvDrafts.map(([groupName, drafts], index) => (
                <details
                  key={groupName}
                  className="group bg-card open:bg-background/30"
                  open={index < 3}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 hover:bg-background/45">
                    <span>
                      <span className="block text-sm font-semibold">
                        {categoryLabel(groupName)}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {drafts.length} suggestion{drafts.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground group-open:hidden">
                      Open
                    </span>
                    <span className="hidden text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground group-open:inline">
                      Close
                    </span>
                  </summary>
                  <div className="grid gap-px bg-border md:grid-cols-2">
                    {drafts.map((draft) => (
                      <div
                        key={draft.sourceRef}
                        className="bg-card p-5 transition-colors hover:bg-background/55"
                      >
                        <p className="text-sm font-semibold leading-snug">
                          {draft.label}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                          {draft.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
