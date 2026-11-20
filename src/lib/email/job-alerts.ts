import type { PersistedJobInput } from "@/lib/jobs/persist-job"
import { sendEmail } from "./send"
import { jobAlertEmail } from "./templates"

/**
 * Emails one digest of newly found jobs. Off unless JOB_ALERT_EMAILS_ENABLED=true: there is no per-user
 * alert preference or unsubscribe yet, so it must not email every user the moment a mail provider is configured.
 */
export async function sendNewJobAlerts(userEmail: string, userId: string, newJobs: PersistedJobInput[]): Promise<void> {
  if (process.env.JOB_ALERT_EMAILS_ENABLED !== "true" || !userEmail || newJobs.length === 0) return
  await sendEmail({
    to: userEmail,
    ...jobAlertEmail(newJobs),
    // At most one digest per user per hour, even if several syncs find jobs.
    idempotencyKey: `job-alert-digest/${userId}/${new Date().toISOString().slice(0, 13)}`,
  })
}
