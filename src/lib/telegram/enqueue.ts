import { Client } from "@upstash/qstash"
import type { TelegramInboundText } from "./types"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobclock.michaelogunjimi.com"

export async function enqueueTelegramUpdate(update: TelegramInboundText): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN
  if (!qstashToken) return false

  const client = new Client({ token: qstashToken })
  await client.publishJSON({
    url: `${APP_URL}/api/telegram/process`,
    body: update,
    retries: 3,
    timeout: 300,
  })
  return true
}
