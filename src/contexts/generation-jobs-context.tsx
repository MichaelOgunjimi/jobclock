"use client"

import { createContext, useContext } from "react"
import type { GenerationJobRow, ApplicationLabel } from "@/hooks/use-generation-jobs"
import type { GenerationKind } from "@/lib/generation/jobs"

interface GenerationJobsContextValue {
  jobs: GenerationJobRow[]
  getActiveJob: (applicationId: string, kind: GenerationKind) => GenerationJobRow | undefined
  getApplicationLabel: (applicationId: string | null) => ApplicationLabel | null
  recentJobs: GenerationJobRow[]
  unseenJobs: GenerationJobRow[]
  unseenCount: number
}

export const GenerationJobsContext = createContext<GenerationJobsContextValue | null>(null)

export function useGenerationJobsContext(): GenerationJobsContextValue {
  const ctx = useContext(GenerationJobsContext)
  if (!ctx) throw new Error("useGenerationJobsContext used outside GenerationJobsProvider")
  return ctx
}
