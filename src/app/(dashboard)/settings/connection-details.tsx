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

export type LimitField = "create" | "delete" | "credit"

const LIMIT_COPY: Record<LimitField, { label: string; hint: (saved: number | null) => string; toast: (saved: number | null) => string }> = {
  create: {
    label: "New applications per day",
    hint: (saved) => `${saved === 0 ? "No limit." : `Currently ${saved}.`} 0 means no limit.`,
    toast: (saved) => (saved === 0 ? "No daily limit" : `Limit set to ${saved} a day`),
  },
  delete: {
    label: "Permanent deletions per day",
    hint: (saved) => `${saved === 0 ? "Deleting is switched off." : `Currently ${saved}.`} 0 switches deleting off for this connection. It can only delete applications you archived first.`,
    toast: (saved) => (saved === 0 ? "Deleting switched off" : `Limit set to ${saved} deletions a day`),
  },
  credit: {
    label: "AI credits per day",
    hint: (saved) => `${saved === null ? "No limit: it can use all your AI credits." : saved === 0 ? "AI generation is switched off." : `Currently ${saved} credits.`} 0 switches AI generation off for this connection. Counted from credits actually charged to it.`,
    toast: (saved) => (saved === null ? "No daily credit limit" : saved === 0 ? "AI generation switched off" : `Limit set to ${saved} credits a day`),
  },
}

/** The owner's daily limit for one thing a token or connected app may do. Create: 0 = no limit. Delete: 0 = off. Credits: a number, "No limit" (explicit) or 0 = generation off. */
export function DailyLimitEditor({ kind, id, value, limit = "create" }: { kind: "token" | "app"; id: string; value: number | null; limit?: LimitField }) {
  const [saved, setSaved] = useState(value)
  const [draft, setDraft] = useState(value === null ? "20" : String(value))
  const [unlimited, setUnlimited] = useState(value === null)
  const [isPending, startTransition] = useTransition()
  const copy = LIMIT_COPY[limit]
  const parsed: number | null = limit === "credit" && unlimited ? null : /^\d+$/.test(draft.trim()) ? Number(draft) : Number.NaN

  function save() {
    startTransition(async () => {
      const result = await setAgentDailyLimit(kind, id, parsed, limit)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setSaved(result.cap)
      toast.success(copy.toast(result.cap))
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={`cap-${limit}-${id}`} className="text-xs text-muted-foreground">{copy.label}</label>
      <Input
        id={`cap-${limit}-${id}`}
        type="number"
        min={0}
        inputMode="numeric"
        value={draft}
        disabled={limit === "credit" && unlimited}
        onChange={(event) => setDraft(event.target.value)}
        className="h-8 w-24"
        aria-describedby={`cap-hint-${limit}-${id}`}
      />
      {limit === "credit" && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="size-4 accent-foreground" checked={unlimited} onChange={(event) => setUnlimited(event.target.checked)} />
          No limit
        </label>
      )}
      <Button type="button" variant="outline" size="sm" onClick={save} disabled={isPending || (parsed !== null && Number.isNaN(parsed)) || parsed === saved}>
        Save
      </Button>
      <span id={`cap-hint-${limit}-${id}`} className="text-xs text-muted-foreground">{copy.hint(saved)}</span>
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
