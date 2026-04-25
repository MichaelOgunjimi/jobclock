import { PRESET_COMPANIES } from "@/lib/jobs/preset-companies"
import { detectAtsFromUrl } from "@/lib/jobs/source-detection"
import { upsertJobIntoCache, fetchJobsForCompany } from "@/lib/jobs/ats/sync"

export interface PresetSyncResult {
  company: string
  synced: number
  skipped: boolean
  error?: string
}

// Run tasks with a fixed concurrency cap so we don't hammer ATS APIs
async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit)
    results.push(...(await Promise.all(batch.map(fn => fn()))))
  }
  return results
}

export async function syncPresetCompanies(options?: {
  concurrency?: number
}): Promise<PresetSyncResult[]> {
  const concurrency = options?.concurrency ?? 5

  const tasks = PRESET_COMPANIES.map(preset => async (): Promise<PresetSyncResult> => {
    const { atsType, boardIdentifier } = detectAtsFromUrl(preset.careersUrl)

    if (!atsType || atsType === "unknown" || !boardIdentifier) {
      return { company: preset.name, synced: 0, skipped: true }
    }

    try {
      const jobs = await fetchJobsForCompany({ atsType, atsBoardIdentifier: boardIdentifier, name: preset.name })
      let synced = 0
      for (const job of jobs) {
        try {
          await upsertJobIntoCache(job)
          synced++
        } catch {
          // individual upsert failures don't abort the company
        }
      }
      return { company: preset.name, synced, skipped: false }
    } catch (err) {
      return {
        company: preset.name,
        synced: 0,
        skipped: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  return withConcurrency(tasks, concurrency)
}
