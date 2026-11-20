import type { PersistedJobInput } from "@/lib/jobs/persist-job"
import { SUPPORT_EMAIL, getAppUrl } from "@/lib/site"

/** A finished email. The same subject/html/text goes to Resend or Beaco, so neither renders anything. */
export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

// Always the production origin: an inbox cannot load images from localhost or a preview URL.
// The files live in public/email/ and are PNG because Gmail and Outlook do not show SVG.
const EMAIL_ASSET_BASE = "https://jobclock.dev"

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

interface LayoutOptions {
  eyebrow: string
  heading: string
  /** Trusted HTML: escape any user-supplied value with escapeHtml before it gets here. */
  bodyHtml: string
  cta?: { label: string; url: string }
  footnote?: string
}

// Same look as the Supabase auth emails (dark header, white card), so every JobClock email matches.
function layout({ eyebrow, heading, bodyHtml, cta, footnote }: LayoutOptions): string {
  const button = cta
    ? `<a href="${escapeHtml(cta.url)}" style="display:block;background-color:#0f0f0f;color:#ffffff;text-align:center;padding:14px 32px;font-size:14px;font-weight:500;text-decoration:none;">${escapeHtml(cta.label)} &rarr;</a>`
    : ""
  const note = footnote ? `<p style="margin:32px 0 0;color:#999;font-size:13px;line-height:1.6;">${footnote}</p>` : ""
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f0;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e5e5e5;max-width:100%;">
<tr><td style="background-color:#0f0f0f;padding:28px 40px;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;"><img src="${EMAIL_ASSET_BASE}/email/logo-mark.png" width="44" height="44" alt="JobClock" style="display:block;border:0;outline:none;"></td>
<td style="padding-left:12px;vertical-align:middle;"><p style="margin:0;color:#ffffff;font-size:16px;font-weight:500;">JobClock</p></td>
</tr></table>
</td></tr>
<tr><td style="padding:40px;">
<p style="margin:0 0 8px;color:#888;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(eyebrow)}</p>
<h1 style="margin:0 0 16px;color:#0f0f0f;font-size:28px;font-weight:600;letter-spacing:-0.04em;line-height:1.1;">${escapeHtml(heading)}</h1>
${bodyHtml}
${button}
${note}
</td></tr>
<tr><td style="background-color:#f9f9f7;border-top:1px solid #e5e5e5;padding:20px 40px;">
<p style="margin:0;color:#999;font-size:12px;">JobClock &mdash; a calmer way to organise your job search. Questions? Reply to this email or write to <a href="mailto:${SUPPORT_EMAIL}" style="color:#999;">${SUPPORT_EMAIL}</a>.</p>
</td></tr>
</table>
</td></tr>
</table>`
}

const paragraph = (text: string) => `<p style="margin:0 0 16px;color:#666;font-size:15px;line-height:1.6;">${escapeHtml(text)}</p>`
const billingUrl = () => `${getAppUrl()}/settings?tab=billing`

export function paymentFailedEmail(): RenderedEmail {
  const cta = { label: "Update payment method", url: billingUrl() }
  const lines = [
    "We could not take your latest JobClock Pro payment.",
    "Pro stays on for 7 days while Stripe tries again. To keep it, update your payment method.",
  ]
  return {
    subject: "Your JobClock payment did not go through",
    html: layout({ eyebrow: "Billing", heading: "Your payment did not go through.", bodyHtml: lines.map(paragraph).join("\n"), cta, footnote: "If you need help, reply to this email." }),
    text: [...lines, `${cta.label}: ${cta.url}`, "If you need help, reply to this email."].join("\n\n"),
  }
}

export function subscriptionEndedEmail(): RenderedEmail {
  const cta = { label: "Manage billing", url: billingUrl() }
  const lines = [
    "Your JobClock Pro subscription has ended, and your account is now on the free plan.",
    "Nothing has been deleted. Your applications and documents are still there, and you can subscribe again any time.",
  ]
  return {
    subject: "Your JobClock Pro subscription has ended",
    html: layout({ eyebrow: "Billing", heading: "Your subscription has ended.", bodyHtml: lines.map(paragraph).join("\n"), cta, footnote: "If you did not expect this, reply to this email." }),
    text: [...lines, `${cta.label}: ${cta.url}`, "If you did not expect this, reply to this email."].join("\n\n"),
  }
}

const MAX_JOBS_SHOWN = 10

export function jobAlertEmail(jobs: PersistedJobInput[]): RenderedEmail {
  const shown = jobs.slice(0, MAX_JOBS_SHOWN)
  const overflow = jobs.length - shown.length
  const plural = jobs.length === 1 ? "" : "s"
  const appUrl = getAppUrl()
  // A job link is only trusted when it is http(s); anything else falls back to the app.
  const linkFor = (job: PersistedJobInput) => (/^https?:\/\//i.test(job.url) ? job.url : appUrl)

  const rows = shown
    .map((job) => {
      const meta = [job.company, job.location].filter(Boolean).map((part) => escapeHtml(String(part))).join(" &middot; ")
      return `<table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e5e5e5;padding:16px 0;">
<tr>
<td style="vertical-align:top;"><p style="margin:0 0 4px;color:#0f0f0f;font-size:15px;font-weight:600;">${escapeHtml(job.title)}</p><p style="margin:0;color:#888;font-size:13px;">${meta}</p></td>
<td style="vertical-align:middle;text-align:right;white-space:nowrap;padding-left:16px;"><a href="${escapeHtml(linkFor(job))}" style="color:#0f0f0f;font-size:13px;font-weight:500;text-decoration:none;">Apply &rarr;</a></td>
</tr>
</table>`
    })
    .join("\n")
  const more = overflow > 0 ? `<p style="margin:16px 0 0;color:#888;font-size:13px;">+ ${overflow} more role${overflow === 1 ? "" : "s"}. Open JobClock to see them all.</p>` : ""
  const cta = { label: "View all jobs", url: `${appUrl}/jobs` }

  return {
    subject: `${jobs.length} new job${plural} at the companies you track`,
    html: layout({
      eyebrow: "Job alert",
      heading: `${jobs.length} new role${plural} for you.`,
      bodyHtml: `${paragraph("New roles just appeared at companies you track.")}\n${rows}\n${more}`,
      cta,
    }),
    text: [
      `${jobs.length} new role${plural} at companies you track:`,
      ...shown.map((job) => `- ${job.title}${job.company ? ` at ${job.company}` : ""}: ${linkFor(job)}`),
      ...(overflow > 0 ? [`+ ${overflow} more. ${cta.url}`] : [`${cta.label}: ${cta.url}`]),
    ].join("\n"),
  }
}
