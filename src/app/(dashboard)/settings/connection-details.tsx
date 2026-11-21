"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ConnectionActivityItem } from "@/lib/mcp/activity"
import { setAgentDailyLimit } from "./actions"

export function formatDate(value: string | null, empty: string) {
  if (!value) return empty
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

/** The owner's daily limit for new applications on one token or connected app. 0 = no limit. */
export function DailyLimitEditor({ kind, id, value }: { kind: "token" | "app"; id: string; value: number }) {
  const [saved, setSaved] = useState(value)
  const [draft, setDraft] = useState(String(value))
  const [isPending, startTransition] = useTransition()
  const parsed = /^\d+$/.test(draft.trim()) ? Number(draft) : NaN

  function save() {
    startTransition(async () => {
      const result = await setAgentDailyLimit(kind, id, parsed)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setSaved(result.dailyCreateCap)
      toast.success(result.dailyCreateCap === 0 ? "No daily limit" : `Limit set to ${result.dailyCreateCap} a day`)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={`cap-${id}`} className="text-xs text-muted-foreground">New applications per day</label>
      <Input
        id={`cap-${id}`}
        type="number"
        min={0}
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className="h-8 w-24"
        aria-describedby={`cap-hint-${id}`}
      />
      <Button type="button" variant="outline" size="sm" onClick={save} disabled={isPending || Number.isNaN(parsed) || parsed === saved}>
        Save
      </Button>
      <span id={`cap-hint-${id}`} className="text-xs text-muted-foreground">
        {saved === 0 ? "No limit." : `Currently ${saved}.`} 0 means no limit.
      </span>
    </div>
  )
}

/** The last changes this connection made. Reads are not recorded, so an empty list can still mean it has been reading. */
export function RecentActivity({ items }: { items: ConnectionActivityItem[] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs text-muted-foreground">Recent activity ({items.length})</summary>
      {items.length === 0 ? (
        <p className="pt-2 text-xs text-muted-foreground">No changes yet. Only changes are listed; reading leaves no record.</p>
      ) : (
        <ul className="space-y-1 pt-2">
          {items.map((item) => (
            <li key={item.id} className="text-xs text-muted-foreground">
              <code className="text-foreground">{item.tool}</code>
              {item.detail ? <> {item.detail}</> : null}
              {" · "}
              {item.applicationSlug ? (
                <Link href={`/applications/${item.applicationSlug}`} className="underline underline-offset-2">
                  {item.applicationTitle ?? "Application"}
                </Link>
              ) : (
                (item.applicationTitle ?? "Application removed")
              )}
              {" · "}
              {formatDate(item.at, "")}
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
