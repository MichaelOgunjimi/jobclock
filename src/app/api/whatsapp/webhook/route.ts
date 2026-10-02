import { after } from "next/server"
import { enqueueWhatsAppMessages } from "@/lib/whatsapp/enqueue"
import { processWhatsAppMessage } from "@/lib/whatsapp/process-message"
import { verifyWhatsAppSignature } from "@/lib/whatsapp/security"
import { parseWhatsAppInboundTexts } from "@/lib/whatsapp/types"

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")

  if (
    mode !== "subscribe" ||
    !challenge ||
    !process.env.WHATSAPP_VERIFY_TOKEN ||
    token !== process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response("Forbidden", { status: 403 })
  }

  return new Response(challenge, { status: 200 })
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return Response.json({ error: "Invalid signature" }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const expectedPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!expectedPhoneNumberId) {
    return Response.json({ error: "WhatsApp is not configured" }, { status: 503 })
  }

  const messages = parseWhatsAppInboundTexts(payload).filter(
    (message) => message.phoneNumberId === expectedPhoneNumberId
  )
  if (messages.length === 0) return Response.json({ ok: true })

  try {
    const queued = await enqueueWhatsAppMessages(messages)
    if (!queued) {
      after(async () => {
        const results = await Promise.allSettled(messages.map(processWhatsAppMessage))
        for (const result of results) {
          if (result.status === "rejected") {
            console.error("[whatsapp] background message failed", result.reason)
          }
        }
      })
    }
    return Response.json({ ok: true, queued })
  } catch (error) {
    console.error("[whatsapp] failed to enqueue messages", error)
    return Response.json({ error: "Unable to accept messages" }, { status: 503 })
  }
}
