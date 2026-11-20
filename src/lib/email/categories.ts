/**
 * The optional emails a user can turn on. Every one is off until they opt in. Billing and account-security
 * emails are not listed: they are always sent. `id` is what links and the sent-email log use; `column` is the
 * property on the `emailPreferences` table.
 */
export const EMAIL_CATEGORIES = [
  { id: "weekly_digest", column: "weeklyDigest", label: "Weekly digest", description: "Your overdue follow-ups and application stats, once a week." },
  { id: "follow_up_reminders", column: "followUpReminders", label: "Follow-up reminders", description: "When an application you planned to follow up on is due." },
  { id: "deadline_reminders", column: "deadlineReminders", label: "Deadline reminders", description: "Two days before a saved job stops accepting applications." },
  { id: "interview_reminders", column: "interviewReminders", label: "Interview reminders", description: "The day before an interview, with a link to your prep." },
  { id: "job_alerts", column: "jobAlerts", label: "Job alerts", description: "New roles at the companies you track." },
  { id: "stale_application_nudges", column: "staleApplicationNudges", label: "Stale application nudges", description: "A nudge when an application has had no news for 3 weeks." },
  { id: "credit_alerts", column: "creditAlerts", label: "Credit alerts", description: "When your Pro credits run low and when they reset." },
] as const

export type EmailCategory = (typeof EMAIL_CATEGORIES)[number]["id"]
export type EmailPreferenceColumn = (typeof EMAIL_CATEGORIES)[number]["column"]
export type EmailPreferences = Record<EmailPreferenceColumn, boolean>

export const EMAIL_CATEGORY_IDS: readonly string[] = EMAIL_CATEGORIES.map((category) => category.id)

export function categoryById(id: string) {
  return EMAIL_CATEGORIES.find((category) => category.id === id)
}
