"use server"

import { and, eq, desc, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { db } from "@/lib/db"
import { storyBank } from "@/lib/db/schema"

async function getAuthenticatedUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export interface StoryEntry {
  id: string
  title: string
  situation: string | null
  task: string | null
  action: string | null
  result: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

export async function listStories(): Promise<StoryEntry[]> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return []

  const rows = await db
    .select()
    .from(storyBank)
    .where(eq(storyBank.userId, userId))
    .orderBy(desc(storyBank.updatedAt))

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    situation: r.situation,
    task: r.task,
    action: r.action,
    result: r.result,
    tags: r.tags ?? [],
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: r.updatedAt?.toISOString() ?? new Date().toISOString(),
  }))
}

export async function createStory(data: {
  title: string
  situation?: string
  task?: string
  action?: string
  result?: string
  tags?: string[]
}): Promise<{ id: string } | { error: string }> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return { error: "Unauthorized" }
  if (!data.title.trim()) return { error: "Title is required" }

  const [row] = await db
    .insert(storyBank)
    .values({
      userId,
      title: data.title.trim(),
      situation: data.situation?.trim() || null,
      task: data.task?.trim() || null,
      action: data.action?.trim() || null,
      result: data.result?.trim() || null,
      tags: data.tags ?? [],
    })
    .returning({ id: storyBank.id })

  revalidatePath("/interview")
  return { id: row.id }
}

export async function updateStory(
  id: string,
  data: {
    title?: string
    situation?: string
    task?: string
    action?: string
    result?: string
    tags?: string[]
  }
): Promise<{ error?: string }> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return { error: "Unauthorized" }

  await db
    .update(storyBank)
    .set({
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.situation !== undefined ? { situation: data.situation.trim() || null } : {}),
      ...(data.task !== undefined ? { task: data.task.trim() || null } : {}),
      ...(data.action !== undefined ? { action: data.action.trim() || null } : {}),
      ...(data.result !== undefined ? { result: data.result.trim() || null } : {}),
      ...(data.tags !== undefined ? { tags: data.tags } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(storyBank.id, id), eq(storyBank.userId, userId)))

  revalidatePath("/interview")
  return {}
}

export async function deleteStory(id: string): Promise<{ error?: string }> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return { error: "Unauthorized" }

  await db.delete(storyBank).where(and(eq(storyBank.id, id), eq(storyBank.userId, userId)))

  revalidatePath("/interview")
  return {}
}

export async function importSampleStories(): Promise<{ imported: number } | { error: string }> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return { error: "Unauthorized" }

  const { SAMPLE_STORIES } = await import("@/lib/jobs/sample-stories")

  const sampleTitles = SAMPLE_STORIES.map((s) => s.title)
  const existing = await db
    .select({ title: storyBank.title })
    .from(storyBank)
    .where(and(eq(storyBank.userId, userId), inArray(storyBank.title, sampleTitles)))

  const existingTitles = new Set(existing.map((r) => r.title))
  const toInsert = SAMPLE_STORIES.filter((s) => !existingTitles.has(s.title))

  if (toInsert.length === 0) return { imported: 0 }

  const rows = await db
    .insert(storyBank)
    .values(
      toInsert.map((s) => ({
        userId,
        title: s.title,
        situation: s.situation,
        task: s.task,
        action: s.action,
        result: s.result,
        tags: s.tags,
      }))
    )
    .returning({ id: storyBank.id })

  revalidatePath("/interview")
  return { imported: rows.length }
}
