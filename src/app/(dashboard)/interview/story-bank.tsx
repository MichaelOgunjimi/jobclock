"use client"

import { useState, useTransition } from "react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TagInput } from "@/components/ui/tag-input"
import { toast } from "sonner"
import { BookOpen, ChevronDown, ChevronUp, Download, Plus, Sparkles, Trash2 } from "lucide-react"
import { confirmStory, createStory, updateStory, deleteStory, importSampleStories, type StoryEntry } from "./actions"

function Textarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="min-h-24 w-full resize-none border border-border bg-background/70 px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    />
  )
}

function StoryCard({ story, onDeleted }: { story: StoryEntry; onDeleted: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(story.title)
  const [situation, setSituation] = useState(story.situation ?? "")
  const [task, setTask] = useState(story.task ?? "")
  const [action, setAction] = useState(story.action ?? "")
  const [result, setResult] = useState(story.result ?? "")
  const [tags, setTags] = useState<string[]>(story.tags)
  const [confirmedAt, setConfirmedAt] = useState(story.confirmedAt ?? null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!title.trim()) { toast.error("Title is required"); return }
    startTransition(async () => {
      const res = await updateStory(story.id, { title, situation, task, action, result, tags })
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success("Story saved")
        setEditing(false)
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteStory(story.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        onDeleted(story.id)
        toast.success("Story deleted")
      }
    })
  }

  function handleConfirm() {
    startTransition(async () => {
      const res = await confirmStory(story.id)
      if (res.error) {
        toast.error(res.error)
      } else {
        setConfirmedAt(new Date().toISOString())
        toast.success("Story confirmed as your experience")
      }
    })
  }

  const fields = [
    { label: "Situation", value: story.situation },
    { label: "Task", value: story.task },
    { label: "Action", value: story.action },
    { label: "Result", value: story.result },
  ].filter((f) => f.value)

  return (
    <div className="border border-border bg-card">
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          type="button"
          onClick={() => { setExpanded((v) => !v); setEditing(false) }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{story.title}</p>
            {story.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {story.tags.map((tag) => (
                  <span key={tag} className="border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
        </button>
        <div className="flex items-center gap-2">
          {!confirmedAt && (
            <Button size="sm" onClick={handleConfirm} disabled={isPending}>
              Confirm mine
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => { setEditing((v) => !v); setExpanded(true) }}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="text-muted-foreground transition-colors hover:text-destructive"
            aria-label="Delete story"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded && !editing && fields.length > 0 && (
        <div className="border-t border-border px-5 py-4 space-y-3">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{f.value}</p>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="border-t border-border px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Led migration to microservices" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`situation-${story.id}`}>Situation</Label>
              <Textarea id={`situation-${story.id}`} value={situation} onChange={setSituation} placeholder="Describe the context and background…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`task-${story.id}`}>Task</Label>
              <Textarea id={`task-${story.id}`} value={task} onChange={setTask} placeholder="What was your specific responsibility?" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`action-${story.id}`}>Action</Label>
              <Textarea id={`action-${story.id}`} value={action} onChange={setAction} placeholder="What did you do, step by step?" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`result-${story.id}`}>Result</Label>
              <Textarea id={`result-${story.id}`} value={result} onChange={setResult} placeholder="What was the measurable outcome?" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tags / competencies</Label>
            <TagInput value={tags} onChange={setTags} placeholder="e.g. leadership, problem-solving…" />
            <p className="text-xs text-muted-foreground">Press Enter or comma to add each tag</p>
          </div>
          <Button onClick={handleSave} disabled={isPending} className="min-w-32">
            {isPending ? "Saving…" : "Save story"}
          </Button>
        </div>
      )}
    </div>
  )
}

function AddStoryForm({
  importControl,
  onAdded,
}: {
  importControl: ReactNode
  onAdded: (story: StoryEntry) => void
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [situation, setSituation] = useState("")
  const [task, setTask] = useState("")
  const [action, setAction] = useState("")
  const [result, setResult] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [isPending, startTransition] = useTransition()

  function reset() {
    setTitle(""); setSituation(""); setTask(""); setAction(""); setResult(""); setTags([])
    setOpen(false)
  }

  function handleCreate() {
    if (!title.trim()) { toast.error("Title is required"); return }
    startTransition(async () => {
      const res = await createStory({ title, situation, task, action, result, tags })
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      onAdded({
        id: res.id,
        title: title.trim(),
        situation: situation.trim() || null,
        task: task.trim() || null,
        action: action.trim() || null,
        result: result.trim() || null,
        tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      toast.success("Story added")
      reset()
    })
  }

  if (!open) {
    return (
      <div className="border border-border bg-card px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center border border-border bg-secondary/60 text-muted-foreground">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Story workspace</p>
              <p className="text-xs text-muted-foreground">
                Capture one STAR story at a time, then tag it for interview practice.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {importControl}
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add story
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-border bg-card">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center border border-border bg-secondary/60 text-muted-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">New story</p>
            <h2 className="text-lg font-semibold leading-tight">Draft a STAR story</h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              Keep it specific enough to reuse in interview prep: context, ownership, action, and evidence.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {importControl}
          <Button variant="outline" onClick={reset}>Cancel</Button>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="space-y-1.5">
          <Label>Story title *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Resolved a production incident under pressure"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="border border-border bg-background/35 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label>Situation</Label>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Context</span>
            </div>
            <Textarea value={situation} onChange={setSituation} placeholder="What was happening, and why did it matter?" rows={4} />
          </div>
          <div className="border border-border bg-background/35 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label>Task</Label>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ownership</span>
            </div>
            <Textarea value={task} onChange={setTask} placeholder="What were you responsible for?" rows={4} />
          </div>
          <div className="border border-border bg-background/35 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label>Action</Label>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Decisions</span>
            </div>
            <Textarea value={action} onChange={setAction} placeholder="What did you do, step by step?" rows={4} />
          </div>
          <div className="border border-border bg-background/35 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label>Result</Label>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Evidence</span>
            </div>
            <Textarea value={result} onChange={setResult} placeholder="What changed? Add numbers where you can." rows={4} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Tags / competencies</Label>
          <TagInput value={tags} onChange={setTags} placeholder="e.g. leadership, problem-solving, incident management…" />
          <p className="text-xs text-muted-foreground">Press Enter or comma to add each tag.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-border bg-secondary/25 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Save it as a reusable story, then edit the wording as your interview prep gets sharper.
        </p>
        <div className="flex gap-2">
          <Button onClick={handleCreate} disabled={isPending || !title.trim()}>
            {isPending ? "Adding…" : "Add story"}
          </Button>
          <Button variant="outline" onClick={reset}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

export function StoryBank({ initial }: { initial: StoryEntry[] }) {
  const [stories, setStories] = useState<StoryEntry[]>(initial)
  const [importing, startImport] = useTransition()

  function handleAdded(story: StoryEntry) {
    setStories((prev) => [story, ...prev])
  }

  function handleDeleted(id: string) {
    setStories((prev) => prev.filter((s) => s.id !== id))
  }

  function handleImport() {
    startImport(async () => {
      const res = await importSampleStories()
      if ("error" in res) {
        toast.error(res.error)
      } else {
        toast.success(`${res.imported} example stories loaded — edit them to match your own experience`)
        // Reload page to show the newly inserted stories
        window.location.reload()
      }
    })
  }

  return (
    <div className="space-y-6">
      <AddStoryForm
        importControl={
          <Button variant="outline" size="sm" onClick={handleImport} disabled={importing}>
          <Download className="mr-1.5 h-4 w-4" />
          {importing ? "Loading…" : "Load starter templates"}
        </Button>
        }
        onAdded={handleAdded}
      />

      {stories.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No stories yet</p>
          <p className="text-xs text-muted-foreground/70 max-w-xs">
            Add your own STAR stories, or load starter templates. Templates are
            not used as evidence until you edit and confirm that they are true.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} onDeleted={handleDeleted} />
          ))}
        </div>
      )}
    </div>
  )
}
