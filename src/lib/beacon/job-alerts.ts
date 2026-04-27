import type { PersistedJobInput } from "@/lib/jobs/persist-job"
import { sendBeaconEventBatch } from "./client"

const TEMPLATE_ID = process.env.BEACON_JOB_ALERT_TEMPLATE_ID ?? ""
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobclock.michaelogunjimi.com"

export async function sendNewJobAlerts(
  userEmail: string,
  userId: string,
  newJobs: PersistedJobInput[]
): Promise<void> {
  if (!TEMPLATE_ID || newJobs.length === 0) return

  const events = newJobs.map((job) => {
    const locationLine = job.location ? `\n${job.location}` : ""
    const descriptionExcerpt = job.description
      ? job.description.replace(/\s+/g, " ").trim().slice(0, 300) + (job.description.length > 300 ? "…" : "")
      : "No description available."

    return {
      event_type: "job.new_match",
      template_id: TEMPLATE_ID,
      recipients: [{ channels: ["email" as const], email: userEmail, user_id: userId }],
      payload: {
        title: job.title,
        company: job.company,
        location_line: locationLine,
        description_excerpt: descriptionExcerpt,
        job_url: job.url.startsWith("http") ? job.url : `${APP_URL}/jobs`,
      },
      // Deduplicate: one alert per user per job URL
      idempotency_key: `job-alert::${userId}::${job.url}`,
    }
  })

  await sendBeaconEventBatch(events)
}
