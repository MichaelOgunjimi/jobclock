/**
 * One-time script to register cron schedules with Upstash QStash.
 * Run once after deploying: npx tsx scripts/setup-qstash-schedules.ts
 *
 * Required env vars (copy from .env.local):
 *   QSTASH_TOKEN      — from Upstash console → QStash → API Keys
 *   NEXT_PUBLIC_APP_URL — your deployed app URL e.g. https://jobclock.vercel.app
 *   CRON_SECRET       — same value as set in Vercel env vars
 */

import { Client } from "@upstash/qstash"

const token = process.env.QSTASH_TOKEN
const appUrl = process.env.NEXT_PUBLIC_APP_URL
const cronSecret = process.env.CRON_SECRET

if (!token || !appUrl || !cronSecret) {
  console.error("Missing required env vars: QSTASH_TOKEN, NEXT_PUBLIC_APP_URL, CRON_SECRET")
  process.exit(1)
}

const client = new Client({ token })

const schedules = [
  {
    name: "sync-companies",
    destination: `${appUrl}/api/cron/sync-companies`,
    cron: "0 */2 * * *", // every 2 hours
  },
]

async function main() {
  // List existing schedules so we don't create duplicates
  const existing = await client.schedules.list()
  const existingDestinations = new Set(existing.schedules?.map((s) => s.destination) ?? [])

  for (const schedule of schedules) {
    if (existingDestinations.has(schedule.destination)) {
      console.log(`✓ Already registered: ${schedule.name}`)
      continue
    }

    await client.schedules.create({
      destination: schedule.destination,
      cron: schedule.cron,
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    })
    console.log(`✓ Registered: ${schedule.name} (${schedule.cron})`)
  }

  console.log("\nDone. View schedules at https://console.upstash.com/qstash")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
