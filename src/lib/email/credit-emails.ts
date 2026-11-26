import { and, eq, gt, gte, lte, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { aiUsagePeriods, emailPreferences, profiles } from "@/lib/db/schema"
import { sendOptionalEmail } from "./optional"
import type { JobRunResult } from "./application-emails"
import { creditsLowEmail, creditsResetEmail } from "./templates"

const DAY_MS = 86_400_000
const LOW_FRACTION = 0.2

/** Remaining credits are under 20% of the allowance. Reserved credits count as spent, as they do when a new action is checked. */
export const isLowOnCredits = (limit: number, used: number, reserved: number) => limit > 0 && limit - used - reserved < limit * LOW_FRACTION

/** More than half of the allowance was used. */
export const usedMostOfAllowance = (limit: number, used: number) => limit > 0 && used * 2 > limit

// A user who is on Pro: an active subscription or a grant that has not expired.
const onProPlan = (nowIso: string) => sql`(
  exists (select 1 from billing_subscriptions s where s.user_id = ${aiUsagePeriods.userId} and s.status in ('active', 'trialing'))
  or exists (select 1 from billing_grants g where g.user_id = ${aiUsagePeriods.userId} and (g.expires_at is null or g.expires_at > ${nowIso}::timestamptz))
)`

async function eachPeriod<T extends { userId: string }>(rows: T[], label: string, send: (row: T) => Promise<boolean>): Promise<JobRunResult> {
  let sent = 0
  let failed = 0
  for (const row of rows) {
    try {
      if (await send(row)) sent += 1
    } catch (err) {
      failed += 1
      console.error(`[email/${label}] failed for a user:`, err instanceof Error ? err.message : err)
    }
  }
  return { eligible: rows.length, sent, failed }
}

/**
 * Credits low: once per allowance period, when a Pro user's remaining credits fall under 20%. It reads the usage table
 * on the daily cron instead of hooking into every AI call, so the AI path stays untouched; the email can be up to a day late.
 */
export async function sendCreditsLowEmails(now = new Date()): Promise<JobRunResult> {
  const rows = await db
    .select({ userId: aiUsagePeriods.userId, start: aiUsagePeriods.periodStart, end: aiUsagePeriods.periodEnd, limit: aiUsagePeriods.creditLimit, used: aiUsagePeriods.creditsUsed, reserved: aiUsagePeriods.creditsReserved, timezone: profiles.timezone })
    .from(aiUsagePeriods)
    .innerJoin(emailPreferences, and(eq(emailPreferences.userId, aiUsagePeriods.userId), eq(emailPreferences.creditAlerts, true)))
    .leftJoin(profiles, eq(profiles.id, aiUsagePeriods.userId))
    .where(and(
      lte(aiUsagePeriods.periodStart, now),
      gt(aiUsagePeriods.periodEnd, now),
      onProPlan(now.toISOString()),
    ))

  return eachPeriod(rows.filter((row) => isLowOnCredits(row.limit, row.used, row.reserved)), "credits-low", (row) =>
    sendOptionalEmail({
      userId: row.userId,
      category: "credit_alerts",
      dedupeKey: `low:${row.start.toISOString()}`,
      render: (url) => creditsLowEmail({ remaining: row.limit - row.used - row.reserved, limit: row.limit, resetsAt: row.end.toISOString(), timezone: row.timezone }, url),
    }),
  )
}

/**
 * Credits reset: the day after an allowance period ends, to a Pro user who used more than half of it. A new period row is only
 * created when the user next uses AI, so the finished period is what tells us the allowance has refreshed.
 */
export async function sendCreditsResetEmails(now = new Date()): Promise<JobRunResult> {
  const rows = await db
    .select({ userId: aiUsagePeriods.userId, start: aiUsagePeriods.periodStart, limit: aiUsagePeriods.creditLimit, used: aiUsagePeriods.creditsUsed })
    .from(aiUsagePeriods)
    .innerJoin(emailPreferences, and(eq(emailPreferences.userId, aiUsagePeriods.userId), eq(emailPreferences.creditAlerts, true)))
    .where(and(
      lte(aiUsagePeriods.periodEnd, now),
      gte(aiUsagePeriods.periodEnd, new Date(now.getTime() - 2 * DAY_MS)),
      onProPlan(now.toISOString()),
    ))

  return eachPeriod(rows.filter((row) => usedMostOfAllowance(row.limit, row.used)), "credits-reset", (row) =>
    sendOptionalEmail({
      userId: row.userId,
      category: "credit_alerts",
      dedupeKey: `reset:${row.start.toISOString()}`,
      render: (url) => creditsResetEmail({ limit: row.limit }, url),
    }),
  )
}
