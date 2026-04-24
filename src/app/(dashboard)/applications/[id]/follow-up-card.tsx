"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { Bell, CalendarDays } from "lucide-react"
import { formatDistanceToNow, isPast } from "date-fns"
import { cn } from "@/lib/utils"
import { updateFollowUp } from "./actions"

interface Props {
  applicationId: string
  initialFollowUpDueAt: string | null
  initialFollowUpNotes: string | null
}

export function FollowUpCard({ applicationId, initialFollowUpDueAt, initialFollowUpNotes }: Props) {
  const [followUpDueAt, setFollowUpDueAt] = useState(
    initialFollowUpDueAt ? initialFollowUpDueAt.slice(0, 10) : ""
  )
  const [followUpNotes, setFollowUpNotes] = useState(initialFollowUpNotes ?? "")
  const [isPending, startTransition] = useTransition()

  const isOverdue = initialFollowUpDueAt ? isPast(new Date(initialFollowUpDueAt)) : false

  function handleSave() {
    startTransition(async () => {
      const result = await updateFollowUp(applicationId, {
        followUpDueAt: followUpDueAt || null,
        followUpNotes: followUpNotes || null,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Follow-up saved")
      }
    })
  }

  function handleClear() {
    setFollowUpDueAt("")
    setFollowUpNotes("")
    startTransition(async () => {
      await updateFollowUp(applicationId, { followUpDueAt: null, followUpNotes: null })
      toast.success("Follow-up cleared")
    })
  }

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className={cn("h-4 w-4", isOverdue ? "text-amber-500" : "text-muted-foreground")} />
          Follow-up
          {isOverdue && (
            <span className="ml-auto text-xs font-normal text-amber-600 dark:text-amber-400">
              Overdue {initialFollowUpDueAt ? formatDistanceToNow(new Date(initialFollowUpDueAt), { addSuffix: true }) : ""}
            </span>
          )}
          {initialFollowUpDueAt && !isOverdue && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              Due {formatDistanceToNow(new Date(initialFollowUpDueAt), { addSuffix: true })}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-1.5">
          <Label htmlFor="follow-up-date" className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            Follow-up date
          </Label>
          <input
            id="follow-up-date"
            type="date"
            value={followUpDueAt}
            onChange={(e) => setFollowUpDueAt(e.target.value)}
            className="w-full border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="follow-up-notes">Notes</Label>
          <textarea
            id="follow-up-notes"
            value={followUpNotes}
            onChange={(e) => setFollowUpNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Email recruiter if no response by Friday…"
            className="w-full resize-none border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
          {(followUpDueAt || followUpNotes) && (
            <Button size="sm" variant="outline" onClick={handleClear} disabled={isPending}>
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
