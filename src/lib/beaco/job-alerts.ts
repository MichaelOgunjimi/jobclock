import type { PersistedJobInput } from "@/lib/jobs/persist-job"
import { sendBeacoEvent } from "./client"

const TEMPLATE_ID = process.env.BEACO_JOB_ALERT_TEMPLATE_ID ?? ""
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobclock.michaelogunjimi.com"

function buildJobsListHtml(jobs: PersistedJobInput[]): string {
  const shown = jobs.slice(0, 10)
  const overflow = jobs.length - shown.length

  const rows = shown
    .map((job) => {
      const meta = [job.company, job.location].filter(Boolean).join(" &middot; ")
      const url = job.url.startsWith("http") ? job.url : APP_URL
      return `<table class="job-row" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e5e5e5;padding:16px 0;">
  <tr>
    <td style="vertical-align:top;">
      <p class="job-title" style="margin:0 0 4px;color:#0f0f0f;font-size:15px;font-weight:600;">${escapeHtml(job.title)}</p>
      <p class="job-meta" style="margin:0;color:#888;font-size:13px;">${meta}</p>
    </td>
    <td style="vertical-align:middle;text-align:right;white-space:nowrap;padding-left:16px;">
      <a class="job-link" href="${url}" style="color:#0f0f0f;font-size:13px;font-weight:500;text-decoration:none;">Apply &rarr;</a>
    </td>
  </tr>
</table>`
    })
    .join("\n")

  const moreNote =
    overflow > 0
      ? `<p style="margin:16px 0 0;color:#888;font-size:13px;">+ ${overflow} more role${overflow === 1 ? "" : "s"} — click "View all" below to see them.</p>`
      : ""

  return rows + moreNote
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export async function sendNewJobAlerts(
  userEmail: string,
  userId: string,
  newJobs: PersistedJobInput[]
): Promise<void> {
  if (!TEMPLATE_ID || newJobs.length === 0) return

  const count = newJobs.length
  await sendBeacoEvent({
    event_type: "job.new_match",
    template_id: TEMPLATE_ID,
    recipients: [{ channels: ["email"], email: userEmail, user_id: userId }],
    payload: {
      job_count: String(count),
      plural_s: count === 1 ? "" : "s",
      jobs_list_html: buildJobsListHtml(newJobs),
      view_all_url: `${APP_URL}/jobs`,
    },
    idempotency_key: `job-alert-digest::${userId}::${new Date().toISOString().slice(0, 13)}`,
  })
}
