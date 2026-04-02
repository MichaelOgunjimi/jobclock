"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { CvData, Json } from "@/lib/supabase/database.types"

export async function saveTemplatePreference(template: string): Promise<void> {
  if (!isSupabaseConfigured()) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  // Fetch current preferences to merge — avoid overwriting unrelated keys
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single()

  const current = (profile?.preferences ?? {}) as Record<string, unknown>

  await supabase
    .from("profiles")
    .update({ preferences: { ...current, preferred_cv_template: template } })
    .eq("id", user.id)
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

  const { error } = await supabase
    .from("customized_cvs")
    .update({ cv_json: data as unknown as Json })
    .eq("id", customizedCvId)
    .eq("application_id", applicationId)
    .eq("user_id", user.id)

  if (error) return { error: "Failed to save tailored CV" }

  revalidatePath(`/applications/${applicationId}`)
  revalidatePath(`/applications/${applicationId}/cv`)
  revalidatePath(`/applications/${applicationId}/cv/print`)

  return { success: true }
}
