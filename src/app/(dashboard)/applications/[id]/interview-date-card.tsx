"use client"

import { useState, useSyncExternalStore, useTransition } from "react"
import { CalendarClock } from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fromLocalInputValue, toLocalInputValue } from "@/lib/applications/interview-at"
import { updateInterviewAt } from "./actions"

const subscribe = () => () => {}

/**
 * Interview date/time. Stored as a UTC instant; the browser's timezone is only
 * used to show and enter it. Rendered after hydration so the server's timezone
 * never leaks into the markup.
 */
export function InterviewDateCard({
  applicationId,
  initialInterviewAt,
}: {
  applicationId: string
  initialInterviewAt: string | null
}) {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false)
  const [saved, setSaved] = useState(initialInterviewAt)
  const [draft, setDraft] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const inputValue = draft ?? toLocalInputValue(saved)
  const nextIso = fromLocalInputValue(inputValue)
  const dirty = draft !== null && nextIso !== saved

  function save(iso: string | null) {
    startTransition(async () => {
      const result = await updateInterviewAt(applicationId, iso)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setSaved(iso)
      setDraft(null)
      toast.success(iso ? "Interview date saved" : "Interview date cleared")
    })
  }

  const savedDate = saved ? new Date(saved) : null
  const timeZone = hydrated ? Intl.DateTimeFormat().resolvedOptions().timeZone : ""

  return (
    <Card id="interview-date">
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Interview date
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {hydrated && savedDate && (
          <div className="border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-800 dark:bg-purple-950">
            <p className="text-base font-semibold text-foreground sm:text-lg">
              {savedDate.toLocaleString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDistanceToNow(savedDate, { addSuffix: true })}
              {timeZone ? ` · ${timeZone}` : ""}
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="interview-at">{saved ? "Change date and time" : "Date and time"}</Label>
          <input
            id="interview-at"
            type="datetime-local"
            value={hydrated ? inputValue : ""}
            disabled={!hydrated}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            {timeZone ? `Times are in your timezone (${timeZone}). ` : ""}
            We email you a reminder the day before.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="sm"
            onClick={() => save(nextIso)}
            disabled={isPending || !dirty || !nextIso}
            className="w-full sm:w-auto"
          >
            {isPending ? "Saving…" : "Save"}
          </Button>
          {saved && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => save(null)}
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
