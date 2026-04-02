"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export async function saveCoverLetterContent({
  applicationId,
  coverLetterId,
  content,
}: {
  applicationId: string
  coverLetterId: string
  content: string
}) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Unauthorized" }

  const { error } = await supabase
    .from("cover_letters")
    .update({ content })
    .eq("id", coverLetterId)
    .eq("user_id", user.id)

  if (error) return { error: "Failed to save cover letter" }

  revalidatePath(`/applications/${applicationId}`)
  revalidatePath(`/applications/${applicationId}/cover-letter`)

  return { success: true }
}

export async function saveCoverLetterTemplatePreference(
  template: string,
): Promise<void> {
  if (!isSupabaseConfigured()) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single()

  const current = (profile?.preferences ?? {}) as Record<string, unknown>

  await supabase
    .from("profiles")
    .update({
      preferences: { ...current, preferred_cover_letter_template: template },
    })
    .eq("id", user.id)
}
