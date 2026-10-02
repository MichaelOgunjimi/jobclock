import { Client } from "@upstash/qstash"
import type { WhatsAppInboundText } from "./types"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobclock.michaelogunjimi.com"

export async function enqueueWhatsAppMessages(
  messages: WhatsAppInboundText[]
): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN
  if (!qstashToken) return false

  const client = new Client({ token: qstashToken })
  await Promise.all(
    messages.map((message) =>
      client.publishJSON({
        url: `${APP_URL}/api/whatsapp/process`,
        body: message,
        retries: 3,
        timeout: 300,
      })
    )
  )
  return true
}

