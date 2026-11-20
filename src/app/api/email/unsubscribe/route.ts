import { categoryById } from "@/lib/email/categories"
import { disableEmails } from "@/lib/email/preferences"
import { escapeHtml } from "@/lib/email/templates"
import { unsubscribeUrl, verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token"
import { getAppUrl } from "@/lib/site"

export const runtime = "nodejs"

// Public on purpose: the signed token in the link is the only credential, so no login is needed.
// GET is the link in the email; POST is the one-click unsubscribe mail clients send for the List-Unsubscribe-Post header.

function page(heading: string, bodyHtml: string, status = 200) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="color-scheme" content="light dark"><title>${escapeHtml(heading)} | JobClock</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.25rem;line-height:1.6;color:#0f0f0f;background:#fff}h1{font-size:1.5rem;margin:0 0 1rem}a{color:inherit}p{margin:0 0 1rem}@media (prefers-color-scheme:dark){body{color:#f5f5f2;background:#0a0a0a}}</style>
</head><body><h1>${escapeHtml(heading)}</h1>${bodyHtml}</body></html>`
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } })
}

async function unsubscribe(request: Request) {
  const verified = verifyUnsubscribeToken(new URL(request.url).searchParams.get("t") ?? "")
  if (!verified) return null
  await disableEmails(verified.userId, verified.scope)
  return verified
}

export async function GET(request: Request) {
  try {
    const result = await unsubscribe(request)
    if (!result) return page("This link is not valid", "<p>The unsubscribe link is incomplete or has been changed. You can choose which emails you get in <a href=\"" + escapeHtml(`${getAppUrl()}/settings?tab=emails`) + "\">Settings</a>.</p>", 400)

    const what = result.scope === "all" ? "any optional emails" : `${escapeHtml(categoryById(result.scope)!.label.toLowerCase())} emails`
    const all = result.scope === "all" ? "" : `<p><a href="${escapeHtml(unsubscribeUrl(result.userId, "all"))}">Unsubscribe from all optional JobClock emails</a></p>`
    return page(
      "You are unsubscribed",
      `<p>You will not get ${what} from JobClock any more. Billing and account emails still reach you, because they are about your account.</p>${all}<p><a href="${escapeHtml(`${getAppUrl()}/settings?tab=emails`)}">Choose which emails you get</a></p>`,
    )
  } catch (err) {
    console.error("[email/unsubscribe] failed:", err instanceof Error ? err.message : err)
    return page("Something went wrong", "<p>We could not update your email settings. Please try the link again, or change them in Settings.</p>", 500)
  }
}

export async function POST(request: Request) {
  try {
    return (await unsubscribe(request)) ? new Response("Unsubscribed", { status: 200 }) : new Response("Invalid unsubscribe link", { status: 400 })
  } catch (err) {
    console.error("[email/unsubscribe] failed:", err instanceof Error ? err.message : err)
    return new Response("Could not unsubscribe", { status: 500 })
  }
}
