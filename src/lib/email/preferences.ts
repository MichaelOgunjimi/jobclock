import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { emailPreferences } from "@/lib/db/schema"
import { EMAIL_CATEGORIES, categoryById, type EmailCategory, type EmailPreferences } from "./categories"
import type { UnsubscribeScope } from "./unsubscribe-token"

const ALL_OFF = Object.fromEntries(EMAIL_CATEGORIES.map((category) => [category.column, false])) as EmailPreferences

/** A user with no row has never opted in, so everything is off. */
export async function getEmailPreferences(userId: string): Promise<EmailPreferences> {
  const [row] = await db.select().from(emailPreferences).where(eq(emailPreferences.userId, userId)).limit(1)
  return row ? Object.fromEntries(EMAIL_CATEGORIES.map((category) => [category.column, row[category.column]])) as EmailPreferences : { ...ALL_OFF }
}

/** Everyone who has turned this category on. Crons start from this list, so a user who never opted in is never even looked at. */
export async function listOptedIn(category: EmailCategory): Promise<string[]> {
  const rows = await db
    .select({ userId: emailPreferences.userId })
    .from(emailPreferences)
    .where(eq(emailPreferences[categoryById(category)!.column], true))
  return rows.map((row) => row.userId)
}

export async function setEmailPreference(userId: string, categoryId: string, enabled: boolean): Promise<boolean> {
  const category = categoryById(categoryId)
  if (!category) return false
  await db
    .insert(emailPreferences)
    .values({ userId, [category.column]: enabled })
    .onConflictDoUpdate({ target: emailPreferences.userId, set: { [category.column]: enabled, updatedAt: new Date() } })
  return true
}

/** Turns one category, or every optional category, off. A user without a row is already off, so this only updates. */
export async function disableEmails(userId: string, scope: UnsubscribeScope): Promise<void> {
  const changes = scope === "all" ? ALL_OFF : { [categoryById(scope)!.column]: false }
  await db.update(emailPreferences).set({ ...changes, updatedAt: new Date() }).where(eq(emailPreferences.userId, userId))
}
