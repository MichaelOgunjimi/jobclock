import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { whatsappMessageReceipts } from "@/lib/db/schema"
import { fetchJobPage } from "@/lib/jobs/fetch-job-page"
import { parseImportedJobPreview } from "@/lib/jobs/import-job"
import { persistJobForUser } from "@/lib/jobs/persist-job"
import { extractFirstJobUrl } from "@/lib/jobs/extract-job-url"
import { sendWhatsAppText } from "./client"
import {
  consumeWhatsAppPairingCode,
  findWhatsAppUserBySender,
  touchWhatsAppConnection,
} from "./pairing"
import type { WhatsAppInboundText } from "./types"

const PAIRING_PATTERN = /^(?:connect|link|pair)(?:\s+jobclock)?[\s:-]+([2-9A-HJ-NP-Z]{8})$/i

export function extractWhatsAppPairingCode(body: string): string | null {
  return body.trim().match(PAIRING_PATTERN)?.[1]?.toUpperCase() ?? null
}

async function claimMessage(messageId: string): Promise<boolean> {
  const [receipt] = await db
    .insert(whatsappMessageReceipts)
    .values({ messageId })
    .onConflictDoNothing()
    .returning({ messageId: whatsappMessageReceipts.messageId })
  return Boolean(receipt)
}

async function releaseMessage(messageId: string): Promise<void> {
  await db
    .delete(whatsappMessageReceipts)
    .where(eq(whatsappMessageReceipts.messageId, messageId))
}

function applicationUrl(applicationSlug: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobclock.michaelogunjimi.com"
  return new URL(`/applications/${applicationSlug}`, appUrl).toString()
}

async function handlePairing(message: WhatsAppInboundText, code: string): Promise<void> {
  const result = await consumeWhatsAppPairingCode({
    code,
    waId: message.from,
    displayName: message.displayName,
  })

  if (result.status === "connected") {
    await sendWhatsAppText(
      message.from,
      "You're connected to JobClock. Send me a job link and I'll extract and save it to your applications."
    )
    return
  }
  if (result.status === "already_connected_elsewhere") {
    await sendWhatsAppText(
      message.from,
      "This WhatsApp number is already connected to another JobClock account. Disconnect it there before trying again."
    )
    return
  }

  await sendWhatsAppText(
    message.from,
    "That pairing code is invalid or has expired. Generate a new one in JobClock Settings → WhatsApp."
  )
}

async function handleJobLink(
  message: WhatsAppInboundText,
  userId: string,
  url: string
): Promise<void> {
  await sendWhatsAppText(message.from, "Got it — I'm importing that job now.")

  try {
    const page = await fetchJobPage(url)
    const preview = await parseImportedJobPreview({
      userId,
      url: page.finalUrl,
      pageTitle: page.pageTitle,
      pageHints: page.pageHints,
      pageText: page.pageText,
    })
    const saved = await persistJobForUser(userId, preview)
    const prefix = saved.alreadySaved ? "Already saved" : "Saved"
    await sendWhatsAppText(
      message.from,
      `${prefix}: ${preview.title} at ${preview.company}\n\nView in JobClock: ${applicationUrl(saved.applicationSlug)}`
    )
  } catch (error) {
    console.error("[whatsapp] job import failed", {
      messageId: message.messageId,
      error: error instanceof Error ? error.message : error,
    })
    await sendWhatsAppText(
      message.from,
      "I couldn't read that job page. It may require a login or block automated access. Please open JobClock to add the missing details manually."
    )
  }
}

export async function processWhatsAppMessage(message: WhatsAppInboundText): Promise<void> {
  if (!(await claimMessage(message.messageId))) return

  try {
    const expectedPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    if (!expectedPhoneNumberId || message.phoneNumberId !== expectedPhoneNumberId) {
      throw new Error("WhatsApp phone number ID did not match the configured account")
    }

    const pairingCode = extractWhatsAppPairingCode(message.body)
    if (pairingCode) {
      await handlePairing(message, pairingCode)
      return
    }

    const userId = await findWhatsAppUserBySender(message.from)
    if (!userId) {
      await sendWhatsAppText(
        message.from,
        "Connect this number first: open JobClock Settings → WhatsApp, generate a pairing code, then send the prepared message here."
      )
      return
    }

    await touchWhatsAppConnection(userId)
    const url = extractFirstJobUrl(message.body)
    if (!url) {
      await sendWhatsAppText(
        message.from,
        "Send me a job listing link beginning with https:// and I'll save it to JobClock."
      )
      return
    }

    await handleJobLink(message, userId, url)
  } catch (error) {
    await releaseMessage(message.messageId)
    throw error
  }
}
