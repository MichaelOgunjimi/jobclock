import { db } from "@/lib/db"
import { generationJobs } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { markRunning, markDone, markFailed, type GenerationJob } from "./jobs"
import { getHandler } from "./handlers"
// Side-effect: register all handlers. dispatch is the chokepoint both the
// QStash callback route and the inline (no-QSTASH_TOKEN) path go through, so
// registering here guarantees handlers exist regardless of entry point.
import "./register"

/**
 * Executes one generation job end-to-end. Used both by the QStash callback
 * route and (when QSTASH_TOKEN is unset) inline from enqueue for dev parity.
 * Throws on handler failure so the QStash callback can return 5xx and retry.
 */
export async function runJob(jobId: string): Promise<void> {
  const rows = (await db
    .select()
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))) as GenerationJob[]

  const job = rows[0]
  if (!job) {
    throw new Error(`Generation job not found: ${jobId}`)
  }

  await markRunning(job.id)

  try {
    const handler = getHandler(job.kind)
    const resultRef = await handler(job)
    await markDone(job.id, resultRef)
  } catch (err) {
    await markFailed(job.id, err instanceof Error ? err.message : String(err))
    throw err
  }
}
