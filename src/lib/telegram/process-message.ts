import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { telegramUpdateReceipts } from "@/lib/db/schema"
import { extractFirstJobUrl } from "@/lib/jobs/extract-job-url"
import { fetchJobPage } from "@/lib/jobs/fetch-job-page"
import { JobImportError, parseImportedJobPreview } from "@/lib/jobs/import-job"
import { persistJobForUser } from "@/lib/jobs/persist-job"
import { answerTelegramCallback, editTelegramText, escapeHtml, sendTelegramText } from "./client"
import {
  consumeTelegramPairingToken,
  disconnectTelegram,
  findTelegramUser,
  getTelegramConnection,
  isTelegramDigestEnabled,
  setTelegramDigest,
  touchTelegramConnection,
} from "./pairing"
import { buildRecentList, resolveRecentCallback } from "./recent-jobs"
import { formatStats, getApplicationStats } from "./stats"
import type { TelegramInboundCallback, TelegramInboundText } from "./types"

/** Minimum characters of pasted text (besides the link) to import without fetching. */
const PASTED_JOB_MIN_CHARS = 300

const COMMAND_PATTERN = /^\/(start|help|status|recent|stats|digest|disconnect)(?:@[A-Za-z0-9_]{5,32})?(?:\s+(on|off))?\s*$/i

const HELP_TEXT = [
  "👋 <b>JobClock</b> saves jobs to your applications.",
  "",
  "🔗 <b>Send a job link</b> and I'll extract and save it. If a site blocks me, paste the job description together with the link.",
  "",
  "<b>Commands</b>",
  "/recent – your last 5 saved jobs",
  "/stats – your application stats",
  "/digest on|off – weekly follow-ups and stats",
  "/status – your connection status",
  "/disconnect – unlink this Telegram account",
  "/help – show this message",
].join("\n")

const START_PATTERN = /^\/start(?:@([A-Za-z0-9_]{5,32}))?\s+([A-Za-z0-9_-]{1,64})$/i

export function extractTelegramStartToken(
  body: string,
  botUsername = process.env.TELEGRAM_BOT_USERNAME
): string | null {
  const match = body.trim().match(START_PATTERN)
  if (!match) return null

  const mentionedBot = match[1]?.toLowerCase()
  const configuredBot = botUsername?.replace(/^@/, "").toLowerCase()
  if (mentionedBot && (!configuredBot || mentionedBot !== configuredBot)) return null
  return match[2]
}

export async function claimTelegramUpdate(updateId: number): Promise<boolean> {
  const [receipt] = await db
    .insert(telegramUpdateReceipts)
    .values({ updateId })
    .onConflictDoNothing()
    .returning({ updateId: telegramUpdateReceipts.updateId })
  return Boolean(receipt)
}

async function releaseTelegramUpdate(updateId: number): Promise<void> {
  await db
    .delete(telegramUpdateReceipts)
    .where(eq(telegramUpdateReceipts.updateId, updateId))
}

async function handleCommand(
  update: TelegramInboundText,
  userId: string,
  command: string,
  argument?: string
): Promise<void> {
  if (command === "digest") {
    if (argument === "on" || argument === "off") {
      await setTelegramDigest(userId, argument === "on" ? update.chatId : null)
      await sendTelegramText(
        update.chatId,
        argument === "on"
          ? "☀️ <b>Weekly digest on.</b>\nI'll message you every Monday morning with follow-ups due and your stats.\n\n<i>Turn it off with /digest off.</i>"
          : "🌙 <b>Weekly digest off.</b>\nI've removed your chat id from our records."
      )
      return
    }
    const enabled = await isTelegramDigestEnabled(userId)
    await sendTelegramText(update.chatId, `${enabled ? "☀️" : "🌙"} Weekly digest is <b>${enabled ? "on" : "off"}</b>.\nUse /digest ${enabled ? "off" : "on"} to switch it.`)
    return
  }

  if (command === "disconnect") {
    await disconnectTelegram(userId)
    await sendTelegramText(update.chatId, "👋 <b>Disconnected.</b>\nReconnect any time from JobClock Settings → Telegram.")
    return
  }

  if (command === "status") {
    const connection = await getTelegramConnection(userId)
    const since = connection ? connection.connectedAt.slice(0, 10) : "unknown"
    await sendTelegramText(update.chatId, `✅ <b>Connected</b> to JobClock since ${since}.`)
    return
  }

  if (command === "stats") {
    await sendTelegramText(update.chatId, formatStats(await getApplicationStats(userId)))
    return
  }

  const { text, keyboard } = await buildRecentList(userId)
  await sendTelegramText(update.chatId, text, keyboard)
}

function applicationUrl(applicationSlug: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobclock.michaelogunjimi.com"
  return new URL(`/applications/${applicationSlug}`, appUrl).toString()
}

async function handlePairing(update: TelegramInboundText, token: string): Promise<void> {
  const result = await consumeTelegramPairingToken({
    token,
    telegramUserId: update.telegramUserId,
    username: update.username,
    displayName: update.displayName,
  })

  if (result.status === "connected") {
    await sendTelegramText(
      update.chatId,
      "✅ <b>You're connected to JobClock.</b>\nSend me a public job link and I'll extract and save it to your applications."
    )
    return
  }
  if (result.status === "already_connected_elsewhere") {
    await sendTelegramText(
      update.chatId,
      "⚠️ <b>Already connected elsewhere.</b>\nThis Telegram account is linked to another JobClock account. Disconnect it there before trying again."
    )
    return
  }

  await sendTelegramText(
    update.chatId,
    "⌛ <b>That pairing link is invalid or has expired.</b>\nGenerate a new one in JobClock Settings → Telegram."
  )
}

/** Maps an import failure to advice the user can act on. */
function importFailureMessage(error: unknown): string {
  if (error instanceof JobImportError) return `⚠️ ${escapeHtml(error.message)}`
  const reason = error instanceof Error ? error.message : ""
  if (/HTTP (401|403)/.test(reason)) {
    return "🚧 <b>That site blocks automated access.</b>\nPaste the job description here together with the link and I'll import it from your text."
  }
  if (/redirected too many times/.test(reason)) {
    return "🔁 <b>That link keeps redirecting.</b>\nSend the direct job-page URL instead, or paste the job description together with the link."
  }
  return "⚠️ <b>I couldn't read that job page.</b>\nPaste the job description together with the link and I'll import it from your text."
}

async function handleJobLink(
  update: TelegramInboundText,
  userId: string,
  url: string
): Promise<void> {
  await sendTelegramText(update.chatId, "⏳ Got it — importing that job now…")

  try {
    // A link plus a pasted description skips the fetch, so blocked sites still work.
    const pasted = update.body.replace(url, " ").replace(/\s+/g, " ").trim()
    const page = pasted.length >= PASTED_JOB_MIN_CHARS
      ? { finalUrl: url, pageTitle: undefined, pageHints: undefined, pageText: pasted }
      : await fetchJobPage(url)
    const preview = await parseImportedJobPreview({
      userId,
      url: page.finalUrl,
      pageTitle: page.pageTitle,
      pageHints: page.pageHints,
      pageText: page.pageText,
    })
    const saved = await persistJobForUser(userId, preview)
    const heading = saved.alreadySaved ? "📌 <b>Already saved</b>" : "✅ <b>Saved</b>"
    await sendTelegramText(
      update.chatId,
      `${heading}\n<b>${escapeHtml(preview.title)}</b> at ${escapeHtml(preview.company)}\n\n🔗 <a href="${escapeHtml(applicationUrl(saved.applicationSlug))}">View in JobClock</a>`
    )
  } catch (error) {
    console.error("[telegram] job import failed", {
      updateId: update.updateId,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    await sendTelegramText(update.chatId, importFailureMessage(error))
  }
}

export async function processTelegramMessage(update: TelegramInboundText): Promise<void> {
  if (!(await claimTelegramUpdate(update.updateId))) return

  try {
    const pairingToken = extractTelegramStartToken(update.body)
    if (pairingToken) {
      await handlePairing(update, pairingToken)
      return
    }

    const commandMatch = update.body.trim().match(COMMAND_PATTERN)
    const command = commandMatch?.[1].toLowerCase()
    if (command === "help" || command === "start") {
      await sendTelegramText(update.chatId, HELP_TEXT)
      return
    }

    const userId = await findTelegramUser(update.telegramUserId)
    if (!userId) {
      await sendTelegramText(
        update.chatId,
        "🔒 <b>Connect this Telegram account first.</b>\nOpen JobClock Settings → Telegram and select Connect Telegram."
      )
      return
    }

    if (command) {
      await handleCommand(update, userId, command, commandMatch?.[2]?.toLowerCase())
      return
    }

    await touchTelegramConnection(userId)
    const url = extractFirstJobUrl(update.body)
    if (!url) {
      await sendTelegramText(
        update.chatId,
        "🔗 Send me a public job listing link beginning with <code>https://</code> and I'll save it to JobClock."
      )
      return
    }

    await handleJobLink(update, userId, url)
  } catch (error) {
    await releaseTelegramUpdate(update.updateId)
    throw error
  }
}

/** Handles a tap on a /recent button: re-renders the message in place. */
export async function processTelegramCallback(callback: TelegramInboundCallback): Promise<void> {
  const userId = await findTelegramUser(callback.telegramUserId)
  if (!userId) {
    await answerTelegramCallback(callback.callbackId, "Connect your account in JobClock Settings first.")
    return
  }

  const view = await resolveRecentCallback(userId, callback.data)
  await answerTelegramCallback(callback.callbackId, view?.toast)
  if (view) await editTelegramText(callback.chatId, callback.messageId, view.text, view.keyboard)
}
