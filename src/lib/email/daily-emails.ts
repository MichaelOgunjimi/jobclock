import { sendCreditsLowEmails, sendCreditsResetEmails } from "./credit-emails"
import { sendDeadlineReminders, sendFollowUpReminders, sendInterviewReminders, sendStaleApplicationNudges } from "./application-emails"

/**
 * Everything that goes out once a day. Each job runs on its own, so one failing never blocks the others.
 * Add a job here and it runs from /api/cron/daily-emails.
 */
const JOBS = {
  followUps: sendFollowUpReminders,
  deadlines: sendDeadlineReminders,
  interviews: sendInterviewReminders,
  staleApplications: sendStaleApplicationNudges,
  creditsLow: sendCreditsLowEmails,
  creditsReset: sendCreditsResetEmails,
} as const

export async function runDailyEmails(now = new Date()): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {}
  for (const [name, job] of Object.entries(JOBS)) {
    try {
      results[name] = await job(now)
    } catch (err) {
      console.error(`[email/daily] ${name} failed:`, err instanceof Error ? err.message : err)
      results[name] = { error: "failed" }
    }
  }
  return results
}
