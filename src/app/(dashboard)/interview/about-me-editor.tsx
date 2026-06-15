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
import type { InterviewWorkspaceData } from "./data"

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
    <div className="border-b border-border p-5 last:border-b-0">
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {fact.category.replace("_", " ")}
          </p>
          {editing ? (
            <div className="mt-3 space-y-3">
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
              <p className="mt-1 font-medium">{fact.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {fact.detail}
              </p>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="self-start text-muted-foreground hover:text-foreground"
              aria-label={`Edit ${fact.label}`}
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="self-start text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${fact.label}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function AboutMeEditor({
  facts,
  cvFactDrafts,
}: Pick<InterviewWorkspaceData, "facts" | "cvFactDrafts">) {
  const [category, setCategory] = useState("experience")
  const [label, setLabel] = useState("")
  const [detail, setDetail] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

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
        cvFactDrafts.map((draft) => ({ sourceRef: draft.sourceRef })),
      )
      if ("error" in result) {
        setError(result.error)
        return
      }
      window.location.reload()
    })
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="border border-border bg-card p-5">
        <p className="page-kicker">Teach the assistant</p>
        <h2 className="mt-3 font-heading text-2xl">Add something about you.</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Add it once here. Confirmed facts can be reused across many interview
          questions instead of asking you the same thing every time.
        </p>
        <div className="mt-5 space-y-3">
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 w-full border border-border bg-background px-3 text-sm"
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
                {value.replace("_", " ")}
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
            rows={6}
            placeholder="The accurate details you want the assistant to remember."
            className="w-full resize-y border border-border bg-background px-3 py-3 text-sm leading-relaxed outline-none focus:ring-1 focus:ring-ring"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            onClick={addFact}
            disabled={pending || !label.trim() || !detail.trim()}
          >
            <Plus className="mr-1.5 size-4" />
            Add confirmed fact
          </Button>
        </div>
      </section>

      <section className="border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <p className="text-sm font-semibold">What the assistant knows</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {facts.length} confirmed facts
            </p>
          </div>
          {cvFactDrafts.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={importCvFacts}
              disabled={pending}
            >
              <Upload className="mr-1.5 size-3.5" />
              Add from current CV
            </Button>
          )}
        </div>
        {facts.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Nothing confirmed yet. Add a fact or import details from your CV.
          </p>
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
    </div>
  )
}
