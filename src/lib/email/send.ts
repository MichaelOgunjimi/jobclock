import "server-only"

import { Resend } from "resend"
import { sendBeacoEvent } from "@/lib/beaco/client"
import { SUPPORT_EMAIL } from "@/lib/site"

interface Email {
  to: string
  subject: string
  html: string
  /** Plain-text alternative. Improves deliverability; Resend and Beaco derive one from the HTML if omitted. */
  text?: string
  /** Makes a retry (e.g. a replayed Stripe webhook) a no-op instead of a second email. */
  idempotencyKey?: string
}

let warnedNoProvider = false

/**
 * Sends one transactional email. Resend when RESEND_API_KEY is set, otherwise Beaco when BEACO_API_KEY
 * is set (local development), otherwise it logs once and skips. It never throws: a failed email must not
 * break the webhook or cron that asked for it. Returns whether the email was handed to a provider.
 */
export async function sendEmail({ to, subject, html, text, idempotencyKey }: Email): Promise<boolean> {
  try {
    if (process.env.RESEND_API_KEY) {
      const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send(
        {
          from: process.env.EMAIL_FROM || "JobClock <hello@jobclock.dev>",
          to,
          replyTo: SUPPORT_EMAIL,
          subject,
          html,
          text,
        },
        { idempotencyKey },
      )
      if (error) throw new Error(`${error.name}: ${error.message}`)
      return true
    }

    if (process.env.BEACO_API_KEY) {
      // Beaco's `inline` field takes the finished email, so it renders nothing and matches what Resend sends.
      await sendBeacoEvent({
        event_type: "email.transactional",
        recipients: [{ channels: ["email"], email: to }],
        inline: { subject, html, text, reply_to: SUPPORT_EMAIL },
        payload: {},
        idempotency_key: idempotencyKey,
      })
      return true
    }

    if (!warnedNoProvider) {
      warnedNoProvider = true
      console.warn("[email] Neither RESEND_API_KEY nor BEACO_API_KEY is set; emails are skipped.")
    }
    return false
  } catch (err) {
    console.error("[email] send failed:", err instanceof Error ? err.message : err)
    return false
  }
}
