/**
 * One-time script to register cron schedules with Upstash QStash.
 * Run once after deploying:
 *   npx tsx scripts/setup-qstash-schedules.ts --app-url=https://jobclock.dev          (dry run)
 *   npx tsx scripts/setup-qstash-schedules.ts --app-url=https://jobclock.dev --yes    (register)
 *
 * The target is never taken from NEXT_PUBLIC_APP_URL, so a stale env file cannot point
 * production schedules at the wrong host.
 *
 * Required env vars (copy from the target environment):
 *   QSTASH_TOKEN      — from Upstash console → QStash → API Keys
 *   CRON_SECRET       — same value as set in that environment's Vercel env vars
 */

import { Client } from "@upstash/qstash"

const token = process.env.QSTASH_TOKEN
const appUrl = process.argv.find((arg) => arg.startsWith("--app-url="))?.slice("--app-url=".length).replace(/\/$/, "")
const apply = process.argv.includes("--yes")
const cronSecret = process.env.CRON_SECRET

if (!token || !cronSecret) {
  console.error("Missing required env vars: QSTASH_TOKEN, CRON_SECRET")
  process.exit(1)
}
if (!appUrl || !appUrl.startsWith("https://")) {
  console.error("Pass the deployed https URL explicitly: --app-url=https://...")
  process.exit(1)
}
console.log(`Target: ${appUrl}${apply ? "" : "  (dry run, add --yes to register)"}`)

const client = new Client({ token })

const schedules = [
  {
    name: "sync-companies",
    destination: `${appUrl}/api/cron/sync-companies`,
    cron: "0 */2 * * *", // every 2 hours
  },
  {
    name: "telegram-digest",
    destination: `${appUrl}/api/cron/telegram-digest`,
    cron: "0 8 * * 1", // Mondays 08:00 UTC
  },
]

async function main() {
  // List existing schedules so we don't create duplicates
  const existing = await client.schedules.list()
  const existingDestinations = new Set(existing.map((s) => s.destination))

  for (const schedule of schedules) {
    if (existingDestinations.has(schedule.destination)) {
      console.log(`✓ Already registered: ${schedule.name}`)
      continue
    }

    if (!apply) {
      console.log(`• Would register: ${schedule.name} (${schedule.cron}) -> ${schedule.destination}`)
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
