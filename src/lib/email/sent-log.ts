import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { emailSends } from "@/lib/db/schema"

/** Claims a send. False means that email already went out (or another run is sending it), so skip it. */
export async function claimSend(userId: string, category: string, dedupeKey: string): Promise<boolean> {
  const rows = await db.insert(emailSends).values({ userId, category, dedupeKey }).onConflictDoNothing().returning({ key: emailSends.dedupeKey })
  return rows.length > 0
}

/** Undoes a claim after the provider refused the email, so the next run tries again. */
export async function releaseSend(userId: string, category: string, dedupeKey: string): Promise<void> {
  await db.delete(emailSends).where(and(eq(emailSends.userId, userId), eq(emailSends.category, category), eq(emailSends.dedupeKey, dedupeKey)))
}

/** Marks several keys as sent without caring whether they already were. */
export async function recordSent(userId: string, category: string, dedupeKeys: string[]): Promise<void> {
  if (dedupeKeys.length === 0) return
  await db.insert(emailSends).values(dedupeKeys.map((dedupeKey) => ({ userId, category, dedupeKey }))).onConflictDoNothing()
}

/** Which of these keys have already been sent. */
export async function sentKeys(userId: string, category: string, dedupeKeys: string[]): Promise<Set<string>> {
  if (dedupeKeys.length === 0) return new Set()
  const rows = await db
    .select({ key: emailSends.dedupeKey })
    .from(emailSends)
    .where(and(eq(emailSends.userId, userId), eq(emailSends.category, category), inArray(emailSends.dedupeKey, dedupeKeys)))
  return new Set(rows.map((row) => row.key))
}
