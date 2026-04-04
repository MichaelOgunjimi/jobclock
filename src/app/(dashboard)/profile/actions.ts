"use server"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { revalidatePath } from "next/cache"
import type { CvData, Json, WritingStyleTone } from "@/lib/supabase/database.types"

export async function setPrimaryCV(formData: FormData) {
  if (!isSupabaseConfigured()) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const cvId = formData.get("cvId") as string

  // Set new primary first so a failure on the second write leaves multiple primaries
  // (recoverable) rather than zero primaries (broken state)
  await supabase.from("user_cvs").update({ is_primary: true }).eq("id", cvId).eq("user_id", user.id)
  await supabase.from("user_cvs").update({ is_primary: false }).eq("user_id", user.id).neq("id", cvId)

  revalidatePath("/profile")
}

export async function deleteCv(formData: FormData) {
  if (!isSupabaseConfigured()) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const cvId = formData.get("cvId") as string

  const { data: cv } = await supabase
    .from("user_cvs")
    .select("original_file_path, is_primary")
    .eq("id", cvId)
    .eq("user_id", user.id)
    .single()

  if (!cv) return

  // Delete from storage
  if (cv.original_file_path) {
    await supabase.storage.from("cvs").remove([cv.original_file_path])
  }

  await supabase.from("user_cvs").delete().eq("id", cvId).eq("user_id", user.id)

  // If deleted CV was primary, promote the most recent remaining one
  if (cv.is_primary) {
    const { data: remaining } = await supabase
      .from("user_cvs")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (remaining) {
      await supabase.from("user_cvs").update({ is_primary: true }).eq("id", remaining.id)
    }
  }

  revalidatePath("/profile")
}

export async function saveCvData(cvId: string, data: CvData) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const { error } = await supabase
    .from("user_cvs")
    .update({ parsed_json: data as unknown as Json })
    .eq("id", cvId)
    .eq("user_id", user.id)

  if (error) return { error: "Failed to save" }

  revalidatePath(`/profile/${cvId}`)
  revalidatePath("/profile")
  return { success: true }
}

export async function renameCv(formData: FormData) {
  if (!isSupabaseConfigured()) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const cvId = formData.get("cvId") as string
  const name = (formData.get("name") as string).trim()

  if (!name) return

  await supabase
    .from("user_cvs")
    .update({ name })
    .eq("id", cvId)
    .eq("user_id", user.id)

  revalidatePath(`/profile/${cvId}`)
  revalidatePath("/profile")
}

export async function saveWritingStyle(formData: FormData) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const id = formData.get("id") as string | null
  const label = (formData.get("label") as string).trim()
  const content = (formData.get("content") as string).trim()
  const defaultTone = ((formData.get("default_tone") as string | null) || "professional") as WritingStyleTone

  if (!label || !content) return { error: "Label and content are required" }

  if (id) {
    const { data, error } = await supabase
      .from("cover_letter_structures")
      .update({ label, content, default_tone: defaultTone })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("is_built_in", false)
      .select("id, label, content, default_tone, is_built_in, slug, user_id, created_at")
      .single()
    if (error) return { error: error.message }
    revalidatePath("/profile")
    return { success: true, style: data }
  } else {
    const { data, error } = await supabase
      .from("cover_letter_structures")
      .insert({ user_id: user.id, label, content, default_tone: defaultTone, is_built_in: false })
      .select("id, label, content, default_tone, is_built_in, slug, user_id, created_at")
      .single()
    if (error) return { error: error.message }
    revalidatePath("/profile")
    return { success: true, style: data }
  }
}

export async function deleteWritingStyle(formData: FormData) {
  if (!isSupabaseConfigured()) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const id = formData.get("id") as string
  await supabase
    .from("cover_letter_structures")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_built_in", false)

  revalidatePath("/profile")
}

export async function savePreferences(payload: {
  desiredRoles: string[]
  locationsUk: string[]
  targetSalaryMin: number | null
  rightToWorkUk: boolean
  experienceLevel: string[]
}) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const { error } = await supabase
    .from("profiles")
    .update({
      desired_roles: payload.desiredRoles,
      locations_uk: payload.locationsUk.length > 0 ? payload.locationsUk : null,
      target_salary_min: payload.targetSalaryMin,
      right_to_work_uk: payload.rightToWorkUk,
      experience_level: payload.experienceLevel.length > 0 ? payload.experienceLevel : null as unknown as string[] | null,
    })
    .eq("id", user.id)

  if (error) return { error: error.message }
  revalidatePath("/profile")
  return { success: true }
}
