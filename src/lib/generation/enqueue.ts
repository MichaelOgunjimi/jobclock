import { Client } from "@upstash/qstash"
import { aiGenerateRateLimit } from "@/lib/rate-limit"
import { createGenerationJob, type GenerationKind } from "./jobs"
import { runJob } from "./dispatch"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobclock.michaelogunjimi.com"

export interface EnqueueInput {
  userId: string
  kind: GenerationKind
  applicationId: string
  params?: unknown
}

export type EnqueueResult =
  | { jobId: string; deduped: boolean }
  | { error: string }

export async function enqueueGeneration(input: EnqueueInput): Promise<EnqueueResult> {
  const { success } = await aiGenerateRateLimit.limit(input.userId)
  if (!success) {
    return { error: "Too many requests. Please wait a moment before trying again." }
  }

  const { job, deduped } = await createGenerationJob({
    userId: input.userId,
    applicationId: input.applicationId,
    kind: input.kind,
    params: input.params,
  })

  if (deduped) {
    return { jobId: job.id, deduped: true }
  }

  const qstashToken = process.env.QSTASH_TOKEN
  if (qstashToken) {
    const client = new Client({ token: qstashToken })
    await client.publishJSON({
      url: `${APP_URL}/api/generate`,
      body: { jobId: job.id },
    })
  } else {
    // Dev parity: no public callback URL, run inline without blocking the caller.
    void Promise.resolve(runJob(job.id)).catch(() => {})
  }

  return { jobId: job.id, deduped: false }
}
