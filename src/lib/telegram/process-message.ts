import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { telegramUpdateReceipts } from "@/lib/db/schema"
import { extractFirstJobUrl } from "@/lib/jobs/extract-job-url"
import { fetchJobPage } from "@/lib/jobs/fetch-job-page"
import { JobImportError, parseImportedJobPreview } from "@/lib/jobs/import-job"
import { persistJobForUser } from "@/lib/jobs/persist-job"
import { sendTelegramText } from "./client"
import {
  consumeTelegramPairingToken,
  findTelegramUser,
  touchTelegramConnection,
} from "./pairing"
import type { TelegramInboundText } from "./types"

/** Minimum characters of pasted text (besides the link) to import without fetching. */
const PASTED_JOB_MIN_CHARS = 300

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
      "You're connected to JobClock. Send me a public job link and I'll extract and save it to your applications."
    )
    return
  }
  if (result.status === "already_connected_elsewhere") {
    await sendTelegramText(
      update.chatId,
      "This Telegram account is already connected to another JobClock account. Disconnect it there before trying again."
    )
    return
  }

  await sendTelegramText(
    update.chatId,
    "That pairing link is invalid or has expired. Generate a new one in JobClock Settings → Telegram."
  )
}

/** Maps an import failure to advice the user can act on. */
function importFailureMessage(error: unknown): string {
  if (error instanceof JobImportError) return error.message
  const reason = error instanceof Error ? error.message : ""
  if (/HTTP (401|403)/.test(reason)) {
    return "That site blocks automated access. Paste the job description here together with the link and I'll import it from your text."
  }
  if (/redirected too many times/.test(reason)) {
    return "That link keeps redirecting. Send the direct job-page URL instead, or paste the job description together with the link."
  }
  return "I couldn't read that job page. Paste the job description together with the link and I'll import it from your text."
}

async function handleJobLink(
  update: TelegramInboundText,
  userId: string,
  url: string
): Promise<void> {
  await sendTelegramText(update.chatId, "Got it — I'm importing that job now.")

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
    const prefix = saved.alreadySaved ? "Already saved" : "Saved"
    await sendTelegramText(
      update.chatId,
      `${prefix}: ${preview.title} at ${preview.company}\n\nView in JobClock: ${applicationUrl(saved.applicationSlug)}`
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

    const userId = await findTelegramUser(update.telegramUserId)
    if (!userId) {
      await sendTelegramText(
        update.chatId,
        "Connect this Telegram account first: open JobClock Settings → Telegram and select Connect Telegram."
      )
      return
    }

    await touchTelegramConnection(userId)
    const url = extractFirstJobUrl(update.body)
    if (!url) {
      await sendTelegramText(
        update.chatId,
        "Send me a public job listing link beginning with https:// and I'll save it to JobClock."
      )
      return
    }

    await handleJobLink(update, userId, url)
  } catch (error) {
    await releaseTelegramUpdate(update.updateId)
    throw error
  }
}
