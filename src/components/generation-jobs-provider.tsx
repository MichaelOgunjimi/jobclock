"use client"

import { GenerationJobsContext } from "@/contexts/generation-jobs-context"
import { useGenerationJobs } from "@/hooks/use-generation-jobs"

export function GenerationJobsProvider({
  userId,
  children,
}: {
  userId: string
  children: React.ReactNode
}) {
  const value = useGenerationJobs(userId)
  return (
    <GenerationJobsContext.Provider value={value}>
      {children}
    </GenerationJobsContext.Provider>
  )
}
