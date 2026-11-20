import type { PersistedJobInput } from "@/lib/jobs/persist-job"
import { sendOptionalEmail } from "./optional"
import { jobAlertEmail } from "./templates"

/** Emails one digest of newly found jobs, only to a user who turned on job alerts in Settings. */
export async function sendNewJobAlerts(userEmail: string, userId: string, newJobs: PersistedJobInput[]): Promise<void> {
  if (!userEmail || newJobs.length === 0) return
  await sendOptionalEmail({
    userId,
    category: "job_alerts",
    to: userEmail,
    // At most one digest per user per hour, even if several syncs find jobs.
    dedupeKey: `hour:${new Date().toISOString().slice(0, 13)}`,
    render: (unsubscribeUrl) => jobAlertEmail(newJobs, unsubscribeUrl),
  })
}
