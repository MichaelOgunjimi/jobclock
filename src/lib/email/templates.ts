import { summarizeStats } from "@/lib/applications/stats-summary"
import type { PersistedJobInput } from "@/lib/jobs/persist-job"
import type { DigestData, FollowUpItem } from "@/lib/telegram/digest"
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

// Light is the default, written inline so every client shows it. Clients that support
// prefers-color-scheme (Apple Mail, iOS Mail, Outlook apps) switch to these dark colours; Gmail
// ignores them and applies its own automatic dark mode. The header is dark in both, so the white logo works.
const DARK_MODE_CSS = `
:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (prefers-color-scheme: dark){
.em-bg{background-color:#0a0a0a !important}
.em-card{background-color:#171717 !important;border-color:#2c2c2c !important}
.em-head{background-color:#000000 !important}
.em-strong{color:#f5f5f2 !important}
.em-text{color:#b9b9b5 !important}
.em-muted{color:#8b8b87 !important}
.em-btn{background-color:#f5f5f2 !important;color:#0f0f0f !important}
.em-foot{background-color:#101010 !important;border-color:#2c2c2c !important}
.em-rule{border-color:#2c2c2c !important}
}`

interface LayoutOptions {
  /** Shown as the browser/inbox title; the email subject. */
  title: string
  eyebrow: string
  heading: string
  /** Trusted HTML: escape any user-supplied value with escapeHtml before it gets here. */
  bodyHtml: string
  cta?: { label: string; url: string }
  footnote?: string
  /** Optional emails only: adds the unsubscribe line to the footer. Billing and security emails never pass it. */
  unsubscribeUrl?: string
}

const settingsEmailsUrl = () => `${getAppUrl()}/settings?tab=emails`

// The plain-text twin of the footer line, for optional emails.
export const unsubscribeText = (url: string) => `Unsubscribe from these emails: ${url}\nChoose which emails you get: ${settingsEmailsUrl()}`

// Same look as the Supabase auth emails (dark header, white card), so every JobClock email matches.
function layout({ title, eyebrow, heading, bodyHtml, cta, footnote, unsubscribeUrl }: LayoutOptions): string {
  const button = cta
    ? `<a class="em-btn" href="${escapeHtml(cta.url)}" style="display:block;background-color:#0f0f0f;color:#ffffff;text-align:center;padding:14px 32px;font-size:14px;font-weight:500;text-decoration:none;">${escapeHtml(cta.label)} &rarr;</a>`
    : ""
  const note = footnote ? `<p class="em-muted" style="margin:32px 0 0;color:#999999;font-size:13px;line-height:1.6;">${footnote}</p>` : ""
  const unsubscribe = unsubscribeUrl
    ? `<p class="em-muted" style="margin:12px 0 0;color:#999999;font-size:12px;">You are getting this because you turned these emails on. <a class="em-muted" href="${escapeHtml(unsubscribeUrl)}" style="color:#999999;">Unsubscribe</a> or <a class="em-muted" href="${escapeHtml(settingsEmailsUrl())}" style="color:#999999;">choose which emails you get</a>.</p>`
    : ""
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
<style>${DARK_MODE_CSS}</style>
</head>
<body class="em-bg" style="margin:0;padding:0;background-color:#f4f4f0;">
<table class="em-bg" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f0;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<tr><td align="center">
<table class="em-card" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e5e5e5;max-width:100%;">
<tr><td class="em-head" style="background-color:#0f0f0f;padding:28px 40px;">
<table cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;"><img src="${EMAIL_ASSET_BASE}/email/logo-mark.png" width="44" height="44" alt="JobClock" style="display:block;border:0;outline:none;"></td>
<td style="padding-left:12px;vertical-align:middle;"><p style="margin:0;color:#ffffff;font-size:16px;font-weight:500;">JobClock</p></td>
</tr></table>
</td></tr>
<tr><td style="padding:40px;">
<p class="em-muted" style="margin:0 0 8px;color:#888888;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;">${escapeHtml(eyebrow)}</p>
<h1 class="em-strong" style="margin:0 0 16px;color:#0f0f0f;font-size:28px;font-weight:600;letter-spacing:-0.04em;line-height:1.1;">${escapeHtml(heading)}</h1>
${bodyHtml}
${button}
${note}
</td></tr>
<tr><td class="em-foot" style="background-color:#f9f9f7;border-top:1px solid #e5e5e5;padding:20px 40px;">
<p class="em-muted" style="margin:0;color:#999999;font-size:12px;">JobClock &mdash; a calmer way to organise your job search. Questions? Reply to this email or write to <a class="em-muted" href="mailto:${SUPPORT_EMAIL}" style="color:#999999;">${SUPPORT_EMAIL}</a>.</p>
${unsubscribe}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

const paragraph = (text: string) => `<p class="em-text" style="margin:0 0 16px;color:#666666;font-size:15px;line-height:1.6;">${escapeHtml(text)}</p>`
const billingUrl = () => `${getAppUrl()}/settings?tab=billing`

/** One line of a list: a title and a grey detail line on the left, a link on the right. Every value is escaped here. */
const listRow = (title: string, meta: string, url: string, label: string) => `<table class="em-rule" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e5e5e5;padding:16px 0;">
<tr>
<td style="vertical-align:top;"><p class="em-strong" style="margin:0 0 4px;color:#0f0f0f;font-size:15px;font-weight:600;">${escapeHtml(title)}</p><p class="em-muted" style="margin:0;color:#888888;font-size:13px;">${escapeHtml(meta)}</p></td>
<td style="vertical-align:middle;text-align:right;white-space:nowrap;padding-left:16px;"><a class="em-strong" href="${escapeHtml(url)}" style="color:#0f0f0f;font-size:13px;font-weight:500;text-decoration:none;">${escapeHtml(label)} &rarr;</a></td>
</tr>
</table>`

const pluralize = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

export function paymentFailedEmail(): RenderedEmail {
  const subject = "Your JobClock payment did not go through"
  const cta = { label: "Update payment method", url: billingUrl() }
  const lines = [
    "We could not take your latest JobClock Pro payment.",
    "Pro stays on for 7 days while Stripe tries again. To keep it, update your payment method.",
  ]
  return {
    subject,
    html: layout({ title: subject, eyebrow: "Billing", heading: "Your payment did not go through.", bodyHtml: lines.map(paragraph).join("\n"), cta, footnote: "If you need help, reply to this email." }),
    text: [...lines, `${cta.label}: ${cta.url}`, "If you need help, reply to this email."].join("\n\n"),
  }
}

export function subscriptionEndedEmail(): RenderedEmail {
  const subject = "Your JobClock Pro subscription has ended"
  const cta = { label: "Manage billing", url: billingUrl() }
  const lines = [
    "Your JobClock Pro subscription has ended, and your account is now on the free plan.",
    "Nothing has been deleted. Your applications and documents are still there, and you can subscribe again any time.",
  ]
  return {
    subject,
    html: layout({ title: subject, eyebrow: "Billing", heading: "Your subscription has ended.", bodyHtml: lines.map(paragraph).join("\n"), cta, footnote: "If you did not expect this, reply to this email." }),
    text: [...lines, `${cta.label}: ${cta.url}`, "If you did not expect this, reply to this email."].join("\n\n"),
  }
}

const MAX_ROWS_SHOWN = 10

export function jobAlertEmail(jobs: PersistedJobInput[], unsubscribeUrl: string): RenderedEmail {
  const shown = jobs.slice(0, MAX_ROWS_SHOWN)
  const overflow = jobs.length - shown.length
  const plural = jobs.length === 1 ? "" : "s"
  const subject = `${jobs.length} new job${plural} at the companies you track`
  const appUrl = getAppUrl()
  // A job link is only trusted when it is http(s); anything else falls back to the app.
  const linkFor = (job: PersistedJobInput) => (/^https?:\/\//i.test(job.url) ? job.url : appUrl)

  const rows = shown
    .map((job) => listRow(job.title, [job.company, job.location].filter(Boolean).join(" · "), linkFor(job), "Apply"))
    .join("\n")
  const more = overflow > 0 ? `<p class="em-muted" style="margin:16px 0 0;color:#888888;font-size:13px;">+ ${overflow} more role${overflow === 1 ? "" : "s"}. Open JobClock to see them all.</p>` : ""
  const cta = { label: "View all jobs", url: `${appUrl}/jobs` }

  return {
    subject,
    html: layout({
      title: subject,
      eyebrow: "Job alert",
      heading: `${jobs.length} new role${plural} for you.`,
      bodyHtml: `${paragraph("New roles just appeared at companies you track.")}\n${rows}\n${more}`,
      cta,
      unsubscribeUrl,
    }),
    text: [
      `${jobs.length} new role${plural} at companies you track:`,
      ...shown.map((job) => `- ${job.title}${job.company ? ` at ${job.company}` : ""}: ${linkFor(job)}`),
      ...(overflow > 0 ? [`+ ${overflow} more. ${cta.url}`] : [`${cta.label}: ${cta.url}`]),
      "",
      unsubscribeText(unsubscribeUrl),
    ].join("\n"),
  }
}

const dateLabel = (iso: string) => iso.slice(0, 10)

export function weeklyDigestEmail({ followUps, stats }: DigestData, unsubscribeUrl: string): RenderedEmail {
  const subject = "Your weekly JobClock digest"
  const { total, submitted, replied } = summarizeStats(stats.byStatus)
  const byStatus = Object.entries(stats.byStatus).filter(([, count]) => count > 0).map(([status, count]) => `${status} ${count}`).join(", ")
  const lines = [
    `${pluralize(total, "application")} tracked. This week you saved ${stats.savedThisWeek} and applied to ${stats.appliedThisWeek}.`,
    `By status: ${byStatus}.`,
    ...(submitted > 0 ? [`${replied} of ${submitted} sent applications got a reply (${Math.round((replied / submitted) * 100)}%).`] : []),
  ]
  const cta = { label: "Open JobClock", url: `${getAppUrl()}/dashboard` }
  const due = followUps.length > 0
    ? `${paragraph("These follow-ups are due:")}\n${followUps.map((item) => listRow(item.title, `${item.company} · due ${dateLabel(item.dueAt)}`, item.url, "Open")).join("\n")}\n<div style="height:16px;"></div>`
    : ""

  return {
    subject,
    html: layout({ title: subject, eyebrow: "Weekly digest", heading: "Your week in JobClock.", bodyHtml: `${due}${lines.map(paragraph).join("\n")}`, cta, unsubscribeUrl }),
    text: [
      ...(followUps.length > 0 ? ["Follow-ups due:", ...followUps.map((item) => `- ${item.title} at ${item.company} (due ${dateLabel(item.dueAt)}): ${item.url}`), ""] : []),
      ...lines,
      "",
      `${cta.label}: ${cta.url}`,
      "",
      unsubscribeText(unsubscribeUrl),
    ].join("\n"),
  }
}

interface ListEmailOptions {
  subject: string
  eyebrow: string
  heading: string
  intro: string
  items: { title: string; meta: string; url: string }[]
  rowLabel: string
  cta: { label: string; url: string }
  unsubscribeUrl: string
}

// One layout for the reminder emails that list applications: an intro line, up to ten rows, an overflow note.
function listEmail({ subject, eyebrow, heading, intro, items, rowLabel, cta, unsubscribeUrl }: ListEmailOptions): RenderedEmail {
  const shown = items.slice(0, MAX_ROWS_SHOWN)
  const overflow = items.length - shown.length
  const more = overflow > 0 ? `<p class="em-muted" style="margin:16px 0 0;color:#888888;font-size:13px;">+ ${overflow} more. Open JobClock to see them all.</p>` : ""
  const rows = shown.map((item) => listRow(item.title, item.meta, item.url, rowLabel)).join("\n")
  return {
    subject,
    html: layout({ title: subject, eyebrow, heading, bodyHtml: `${paragraph(intro)}\n${rows}\n${more}`, cta, unsubscribeUrl }),
    text: [
      intro,
      ...shown.map((item) => `- ${item.title} (${item.meta}): ${item.url}`),
      ...(overflow > 0 ? [`+ ${overflow} more.`] : []),
      "",
      `${cta.label}: ${cta.url}`,
      "",
      unsubscribeText(unsubscribeUrl),
    ].join("\n"),
  }
}

export function followUpDueEmail(items: FollowUpItem[], unsubscribeUrl: string): RenderedEmail {
  return listEmail({
    subject: `${pluralize(items.length, "follow-up")} due`,
    eyebrow: "Follow-up",
    heading: items.length === 1 ? "A follow-up is due." : "Follow-ups are due.",
    intro: "These applications are waiting on a reply. A short, polite message can help.",
    items: items.map((item) => ({ title: item.title, meta: `${item.company} · due ${dateLabel(item.dueAt)}`, url: item.url })),
    rowLabel: "Open",
    cta: { label: "View applications", url: `${getAppUrl()}/applications` },
    unsubscribeUrl,
  })
}
