"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import type { GenerationKind, GenerationStatus } from "@/lib/generation/jobs"

export interface GenerationJobRow {
  id: string
  user_id: string
  application_id: string | null
  kind: GenerationKind
  status: GenerationStatus
  result_ref: string | null
  error: string | null
  seen_at: string | null
  created_at: string
  updated_at: string
}

export interface ApplicationLabel {
  role: string
  company: string
}

/** Newest-updated done/failed jobs shown in the notifications dropdown. */
export const RECENT_NOTIFICATION_LIMIT = 10

function isTerminal(j: GenerationJobRow): boolean {
  return j.status === "done" || j.status === "failed"
}

export function selectRecentJobs(jobs: GenerationJobRow[]): GenerationJobRow[] {
  return jobs
    .filter(isTerminal)
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, RECENT_NOTIFICATION_LIMIT)
}

export function selectUnseenJobs(jobs: GenerationJobRow[]): GenerationJobRow[] {
  return jobs.filter((j) => isTerminal(j) && !j.seen_at)
}

function kindLabel(kind: GenerationKind): string {
  switch (kind) {
    case "cover_letter": return "Cover letter"
    case "company_research": return "Company research"
    case "interview_prep": return "Interview prep"
    case "cv_tailor": return "Tailored CV"
    case "interview_answer": return "Interview answer"
  }
}

export function useGenerationJobs(userId: string) {
  const [jobs, setJobs] = useState<GenerationJobRow[]>([])
  const [appLabels, setAppLabels] = useState<Map<string, ApplicationLabel>>(
    new Map(),
  )
  const prevStatusRef = useRef<Map<string, GenerationStatus>>(new Map())

  const handleUpdate = useCallback((job: GenerationJobRow) => {
    const prev = prevStatusRef.current.get(job.id)
    prevStatusRef.current.set(job.id, job.status)

    setJobs((all) => {
      const idx = all.findIndex((j) => j.id === job.id)
      if (idx === -1) return [...all, job]
      const next = [...all]
      next[idx] = job
      return next
    })

    if (prev && prev !== "done" && job.status === "done") {
      toast.success(`${kindLabel(job.kind)} ready`, {
        description: "Reload the page to see the result.",
      })
    } else if (prev && prev !== "failed" && job.status === "failed") {
      toast.error(`${kindLabel(job.kind)} failed`, {
        description: job.error ?? "Something went wrong.",
      })
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    void supabase
      .from("generation_jobs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!mounted || !data) return
        const rows = data as unknown as GenerationJobRow[]
        setJobs(rows)
        const map = new Map<string, GenerationStatus>()
        for (const j of rows) map.set(j.id, j.status)
        prevStatusRef.current = map
      })

    const channel = supabase
      .channel(`gen-jobs:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generation_jobs",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!mounted) return
          const isDelete = payload.eventType === "DELETE"
          const job = (isDelete ? payload.old : payload.new) as GenerationJobRow | undefined
          if (job?.id) handleUpdate(job)
        }
      )
      .subscribe()

    return () => {
      mounted = false
      void supabase.removeChannel(channel)
    }
  }, [userId, handleUpdate])

  // Notification rows arrive as raw generation_jobs rows (including via
  // Realtime), so resolve role/company through a client-side application
  // lookup rather than an embedded select that Realtime payloads lack.
  useEffect(() => {
    let mounted = true
    const supabase = createClient()
    void supabase
      .from("applications")
      .select("id, jobs_cache(title, company)")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (!mounted || !data) return
        const map = new Map<string, ApplicationLabel>()
        for (const row of data as unknown as Array<{
          id: string
          jobs_cache: { title: string; company: string } | null
        }>) {
          if (row.jobs_cache) {
            map.set(row.id, {
              role: row.jobs_cache.title,
              company: row.jobs_cache.company,
            })
          }
        }
        setAppLabels(map)
      })
    return () => {
      mounted = false
    }
  }, [userId])

  const getApplicationLabel = useCallback(
    (applicationId: string | null): ApplicationLabel | null =>
      applicationId ? (appLabels.get(applicationId) ?? null) : null,
    [appLabels],
  )

  const getActiveJob = useCallback(
    (applicationId: string, kind: GenerationKind): GenerationJobRow | undefined =>
      jobs.find(
        (j) =>
          j.application_id === applicationId &&
          j.kind === kind &&
          (j.status === "queued" || j.status === "running")
      ),
    [jobs]
  )

  const recentJobs = selectRecentJobs(jobs)
  const unseenJobs = selectUnseenJobs(jobs)

  return {
    jobs,
    getActiveJob,
    getApplicationLabel,
    recentJobs,
    unseenJobs,
    unseenCount: unseenJobs.length,
  }
}
