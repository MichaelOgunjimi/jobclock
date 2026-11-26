"use server"

import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { timezoneRateLimit } from "@/lib/rate-limit"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { isValidTimezone } from "@/lib/timezone"

/**
 * Saves the browser's timezone, but only while the profile has none: a zone the user chose in Account is never overwritten.
 * Silent by design (it runs in the background on dashboard load), so every failure just returns false.
 */
export async function captureBrowserTimezone(timezone: string): Promise<boolean> {
  try {
    if (!isSupabaseConfigured() || !isValidTimezone(timezone)) return false

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    if (!(await timezoneRateLimit.limit(user.id)).success) return false

    const updated = await db
      .update(profiles)
      .set({ timezone })
      .where(and(eq(profiles.id, user.id), isNull(profiles.timezone)))
      .returning({ id: profiles.id })
    return updated.length > 0
  } catch (err) {
    console.error("[timezone] capture failed:", err instanceof Error ? err.message : err)
    return false
  }
}
