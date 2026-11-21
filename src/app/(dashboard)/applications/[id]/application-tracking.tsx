"use client"

import { useState, useSyncExternalStore, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Archive, ArchiveRestore, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TagInput } from "@/components/ui/tag-input"
import {
  APPLIED_AT_HINT,
  normalizeAppliedAt,
  normalizeSource,
  normalizeTags,
  SOURCE_HINT,
  SOURCE_SUGGESTIONS,
  TAGS_HINT,
} from "@/lib/applications/details"
import { archiveApplication, restoreApplication, updateAppliedAt, updateSource, updateTags } from "./actions"

/** Archive hides the application from the list and stops every reminder; nothing is lost, so no confirmation step. */
export function ArchiveButton({ applicationId, archived }: { applicationId: string; archived: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function run() {
    startTransition(async () => {
      const result = await (archived ? restoreApplication : archiveApplication)(applicationId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(archived ? "Restored. Reminders are back on." : "Archived. It's hidden from your list and sends no reminders.")
      router.refresh()
    })
  }

  const Icon = pending ? Loader2 : archived ? ArchiveRestore : Archive
  return (
    <Button
      type="button"
      size="sm"
      variant={archived ? "default" : "outline"}
      className="w-full justify-center xl:w-auto"
      disabled={pending}
      onClick={run}
    >
      <Icon className={pending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
      {archived ? "Restore" : "Archive"}
    </Button>
  )
}

const subscribe = () => () => {}
const pad = (n: number) => String(n).padStart(2, "0")

/** The date shown in the date input: the day in the viewer's timezone, matching how dates are displayed elsewhere. */
function toLocalDate(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function useSave() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  function save(run: () => Promise<{ error?: string }>, success: string, onSaved: () => void) {
    setError(null)
    startTransition(async () => {
      const result = await run()
      if (result.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      onSaved()
      toast.success(success)
      router.refresh()
    })
  }
  return { pending, error, save }
}

const sameTags = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b)

function TagsField({ applicationId, initialTags }: { applicationId: string; initialTags: string[] }) {
  const [saved, setSaved] = useState(initialTags)
  const [tags, setTags] = useState(initialTags)
  const { pending, error, save } = useSave()
  const checked = normalizeTags(tags)
  const next = checked.ok ? checked.value : tags
  const dirty = checked.ok && !sameTags(next, saved)

  return (
    <div className="space-y-1.5">
      <Label>Tags</Label>
      <TagInput value={tags} onChange={setTags} placeholder="Add a tag and press Enter" />
      <p className="text-xs text-muted-foreground">{TAGS_HINT}</p>
      {(!checked.ok || error) && <p role="alert" className="text-xs text-destructive">{checked.ok ? error : checked.error}</p>}
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !dirty}
        onClick={() => save(() => updateTags(applicationId, next), "Tags saved", () => { setSaved(next); setTags(next) })}
        className="w-full sm:w-auto"
      >
        {pending ? "Saving…" : "Save tags"}
      </Button>
    </div>
  )
}

function SourceField({ applicationId, initialSource }: { applicationId: string; initialSource: string | null }) {
  const [saved, setSaved] = useState(initialSource ?? "")
  const [value, setValue] = useState(initialSource ?? "")
  const { pending, error, save } = useSave()
  const checked = normalizeSource(value)
  const next = checked.ok ? (checked.value ?? "") : value
  const dirty = checked.ok && next !== saved

  return (
    <div className="space-y-1.5">
      <Label htmlFor="application-source">Source</Label>
      <Input
        id="application-source"
        value={value}
        list="application-source-options"
        onChange={(event) => setValue(event.target.value)}
        placeholder="e.g. LinkedIn"
        disabled={pending}
      />
      <datalist id="application-source-options">
        {SOURCE_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}
      </datalist>
      <p className="text-xs text-muted-foreground">{SOURCE_HINT}</p>
      {(!checked.ok || error) && <p role="alert" className="text-xs text-destructive">{checked.ok ? error : checked.error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !dirty}
          onClick={() => save(() => updateSource(applicationId, next || null), next ? "Source saved" : "Source cleared", () => { setSaved(next); setValue(next) })}
          className="w-full sm:w-auto"
        >
          {pending ? "Saving…" : "Save source"}
        </Button>
        {saved && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            aria-label="Clear source"
            onClick={() => save(() => updateSource(applicationId, null), "Source cleared", () => { setSaved(""); setValue("") })}
            className="w-full sm:w-auto"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}

function AppliedDateField({ applicationId, initialAppliedAt }: { applicationId: string; initialAppliedAt: string | null }) {
  // The day shown depends on the viewer's timezone, so it is only filled in after hydration.
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  const [saved, setSaved] = useState(initialAppliedAt)
  const [draft, setDraft] = useState<string | null>(null)
  const { pending, error, save } = useSave()

  const savedDate = hydrated ? toLocalDate(saved) : ""
  const value = draft ?? savedDate
  const checked = normalizeAppliedAt(value || null)
  const dirty = draft !== null && draft !== savedDate && checked.ok

  function done(iso: string | null) {
    setSaved(iso)
    setDraft(null)
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="application-applied-at">Applied date</Label>
      <input
        id="application-applied-at"
        type="date"
        value={hydrated ? value : ""}
        disabled={!hydrated || pending}
        onChange={(event) => setDraft(event.target.value)}
        className="w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <p className="text-xs text-muted-foreground">{APPLIED_AT_HINT} Moving the status to Applied only fills this in when it is empty, so your date is kept.</p>
      {(!checked.ok || error) && <p role="alert" className="text-xs text-destructive">{checked.ok ? error : checked.error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !dirty}
          onClick={() => save(() => updateAppliedAt(applicationId, value || null), value ? "Applied date saved" : "Applied date cleared", () => done(value ? `${value}T12:00:00.000Z` : null))}
          className="w-full sm:w-auto"
        >
          {pending ? "Saving…" : "Save date"}
        </Button>
        {saved && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            aria-label="Clear applied date"
            onClick={() => save(() => updateAppliedAt(applicationId, null), "Applied date cleared", () => done(null))}
            className="w-full sm:w-auto"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}

/** Tags, source and applied date: the details the owner corrects by hand. Each saves on its own. */
export function TrackingDetailsCard({
  applicationId,
  tags,
  source,
  appliedAt,
}: {
  applicationId: string
  tags: string[]
  source: string | null
  appliedAt: string | null
}) {
  return (
    <Card id="tracking-details">
      <CardHeader className="border-b">
        <CardTitle>Tracking details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <TagsField applicationId={applicationId} initialTags={tags} />
        <SourceField applicationId={applicationId} initialSource={source} />
        <AppliedDateField applicationId={applicationId} initialAppliedAt={appliedAt} />
      </CardContent>
    </Card>
  )
}
