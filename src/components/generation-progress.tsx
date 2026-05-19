"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { formatElapsed } from "@/lib/relative-time"

/**
 * In-progress card for a background generation job: spinner, what's being
 * generated, and a live elapsed timer counting up from the job's start.
 * Rendered only while the job is active; unmounts (clearing its interval)
 * when the job completes.
 */
export function GenerationProgress({
  label,
  startedAt,
}: {
  label: string
  startedAt: string
}) {
  const start = new Date(startedAt).getTime()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = Number.isNaN(start) ? 0 : now - start

  return (
    <div className="flex items-center gap-3 border border-border bg-secondary px-4 py-3">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center justify-between gap-2 text-[13px] font-medium text-foreground">
          <span className="min-w-0 truncate">Generating {label}…</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {formatElapsed(elapsed)}
          </span>
        </p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Keeps running if you leave the page.
        </p>
      </div>
    </div>
  )
}
