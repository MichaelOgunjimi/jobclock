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

/**
 * Supabase Realtime delivery for `generation_jobs` is unreliable in this
 * deployment (INSERT/UPDATE events frequently never reach the client), which
 * left the in-progress UI stuck until a manual reload. We poll the active set
 * as a Realtime-independent fallback while any job is running.
 */
const ACTIVE_POLL_MS = 4000

export function useGenerationJobs(userId: string) {
  const [jobs, setJobs] = useState<GenerationJobRow[]>([])
  const [appLabels, setAppLabels] = useState<Map<string, ApplicationLabel>>(
    new Map(),
  )
  const prevStatusRef = useRef<Map<string, GenerationStatus>>(new Map())
  const jobsRef = useRef<GenerationJobRow[]>([])

  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])

  // Toast once per status transition (done/failed). Mutates the ref only — no
  // setState — so it is safe to call in a loop while merging a batch.
  const notifyTransition = useCallback((job: GenerationJobRow) => {
    const prev = prevStatusRef.current.get(job.id)
    prevStatusRef.current.set(job.id, job.status)

    if (prev && prev !== "done" && job.status === "done") {
      toast.success(`${kindLabel(job.kind)} ready`, {
        description: "Your result is ready.",
      })
    } else if (prev && prev !== "failed" && job.status === "failed") {
      toast.error(`${kindLabel(job.kind)} failed`, {
        description: job.error ?? "Something went wrong.",
      })
    }
  }, [])

  const handleUpdate = useCallback(
    (job: GenerationJobRow) => {
      notifyTransition(job)
      setJobs((all) => {
        const idx = all.findIndex((j) => j.id === job.id)
        if (idx === -1) return [...all, job]
        const next = [...all]
        next[idx] = job
        return next
      })
    },
    [notifyTransition],
  )

  // Reconcile a freshly-fetched batch in a single state update.
  const mergeJobs = useCallback(
    (rows: GenerationJobRow[]) => {
      for (const r of rows) notifyTransition(r)
      setJobs((all) => {
        const byId = new Map(all.map((j) => [j.id, j]))
        for (const r of rows) byId.set(r.id, r)
        return Array.from(byId.values())
      })
    },
    [notifyTransition],
  )

  const refetch = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("generation_jobs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)
    if (data) mergeJobs(data as unknown as GenerationJobRow[])
  }, [userId, mergeJobs])

  // Optimistically register a just-enqueued job so the in-progress UI appears
  // immediately, without waiting on a Realtime INSERT that may never arrive.
  const trackJob = useCallback(
    (input: {
      id: string
      applicationId: string | null
      kind: GenerationKind
    }) => {
      // A deduped enqueue returns an already-tracked job's id — never let the
      // synthetic 'queued' row overwrite real status/timestamps.
      if (jobsRef.current.some((j) => j.id === input.id)) return
      const now = new Date().toISOString()
      handleUpdate({
        id: input.id,
        user_id: userId,
        application_id: input.applicationId,
        kind: input.kind,
        status: "queued",
        result_ref: null,
        error: null,
        seen_at: null,
        created_at: now,
        updated_at: now,
      })
    },
    [handleUpdate, userId],
  )

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

  // Realtime-independent fallback: while any job is active, re-fetch the set
  // so completion is detected (and the page auto-refreshes) even when no
  // Realtime UPDATE arrives. Idle when nothing is running, so it is cheap.
  useEffect(() => {
    const id = setInterval(() => {
      const hasActive = jobsRef.current.some(
        (j) => j.status === "queued" || j.status === "running",
      )
      if (hasActive) void refetch()
    }, ACTIVE_POLL_MS)
    return () => clearInterval(id)
  }, [refetch])

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
    trackJob,
    recentJobs,
    unseenJobs,
    unseenCount: unseenJobs.length,
  }
}
