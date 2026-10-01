"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { CvData, Json } from "@/lib/supabase/database.types"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { customizedCvs } from "@/lib/db/schema"
import { appendApplicationAuditEvents } from "@/lib/applications/audit"

export async function saveTemplatePreference(
  template: string,
): Promise<{ error?: string; success?: boolean }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  // Fetch current preferences to merge — avoid overwriting unrelated keys
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single()
  if (profileError) return { error: profileError.message }

  const current = (profile?.preferences ?? {}) as Record<string, unknown>

  const { error } = await supabase
    .from("profiles")
    .update({ preferences: { ...current, preferred_cv_template: template } })
    .eq("id", user.id)
  if (error) return { error: error.message }

  return { success: true }
}

export async function saveCustomizedCvData({
  applicationId,
  customizedCvId,
  data,
}: {
  applicationId: string
  customizedCvId: string
  data: CvData
}) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Unauthorized" }

  const updated = await db.transaction(async (tx) => {
    const rows = await tx
      .update(customizedCvs)
      .set({ cvJson: data as unknown as Json })
      .where(and(
        eq(customizedCvs.id, customizedCvId),
        eq(customizedCvs.applicationId, applicationId),
        eq(customizedCvs.userId, user.id),
      ))
      .returning({ id: customizedCvs.id })
    if (!rows[0]) return false
    await appendApplicationAuditEvents(tx, {
      applicationId,
      userId: user.id,
      eventType: "application.cv_edited",
      metadata: { customizedCvId },
    })
    return true
  })

  if (!updated) return { error: "Failed to save tailored CV" }

  revalidatePath(`/applications/${applicationId}`)
  revalidatePath(`/applications/${applicationId}/cv`)
  revalidatePath(`/applications/${applicationId}/cv/print`)

  return { success: true }
}
