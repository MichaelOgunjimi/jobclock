"use server"

import { createClient } from "@/lib/supabase/server"
import { db } from "@/lib/db"
import { generationJobs } from "@/lib/db/schema"
import { and, eq, inArray } from "drizzle-orm"

export async function markJobsSeen(jobIds: string[]): Promise<void> {
  if (jobIds.length === 0) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await db
    .update(generationJobs)
    .set({ seenAt: new Date(), updatedAt: new Date() })
    .where(and(inArray(generationJobs.id, jobIds), eq(generationJobs.userId, user.id)))
}
