"use server"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { revalidatePath } from "next/cache"
import type { CvData, Json, WritingStyleTone } from "@/lib/supabase/database.types"
import type { UserPreferences } from "@/lib/ai"

export async function setPrimaryCV(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const cvId = formData.get("cvId") as string
  if (!cvId) return { error: "CV id is required" }

  // Set new primary first so a failure on the second write leaves multiple primaries
  // (recoverable) rather than zero primaries (broken state)
  const { error: setPrimaryError } = await supabase
    .from("user_cvs")
    .update({ is_primary: true })
    .eq("id", cvId)
    .eq("user_id", user.id)
  if (setPrimaryError) return { error: setPrimaryError.message }

  const { error: clearPrimaryError } = await supabase
    .from("user_cvs")
    .update({ is_primary: false })
    .eq("user_id", user.id)
    .neq("id", cvId)
  if (clearPrimaryError) return { error: clearPrimaryError.message }

  revalidatePath("/profile")
  return { success: true }
}

export async function deleteCv(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const cvId = formData.get("cvId") as string
  if (!cvId) return { error: "CV id is required" }

  const { data: cv, error: cvLookupError } = await supabase
    .from("user_cvs")
    .select("original_file_path, is_primary")
    .eq("id", cvId)
    .eq("user_id", user.id)
    .single()
  if (cvLookupError) return { error: cvLookupError.message }

  if (!cv) return { error: "CV not found" }

  // Delete from storage
  if (cv.original_file_path) {
    const { error: storageError } = await supabase.storage.from("cvs").remove([cv.original_file_path])
    if (storageError) return { error: storageError.message }
  }

  const { error: deleteError } = await supabase
    .from("user_cvs")
    .delete()
    .eq("id", cvId)
    .eq("user_id", user.id)
  if (deleteError) return { error: deleteError.message }

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
      const { error: promoteError } = await supabase
        .from("user_cvs")
        .update({ is_primary: true })
        .eq("id", remaining.id)
      if (promoteError) return { error: promoteError.message }
    }
  }

  revalidatePath("/profile")
  return { success: true }
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

export async function renameCv(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const cvId = formData.get("cvId") as string
  const name = (formData.get("name") as string).trim()

  if (!cvId) return { error: "CV id is required" }
  if (!name) return { error: "Name is required" }

  const { error } = await supabase
    .from("user_cvs")
    .update({ name })
    .eq("id", cvId)
    .eq("user_id", user.id)
  if (error) return { error: error.message }

  revalidatePath(`/profile/${cvId}`)
  revalidatePath("/profile")
  return { success: true }
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

export async function deleteWritingStyle(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const id = formData.get("id") as string
  if (!id) return { error: "Writing style id is required" }

  const { error } = await supabase
    .from("cover_letter_structures")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_built_in", false)
  if (error) return { error: error.message }

  revalidatePath("/profile")
  return { success: true }
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

export async function saveGenerationAutomation(payload: {
  generateCv: boolean
  generateCoverLetter: boolean
}) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const { data: existing } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single()

  const preferences = (existing?.preferences ?? {}) as UserPreferences
  const updated: UserPreferences = {
    ...preferences,
    auto_generate_cv_on_job_add: payload.generateCv,
    auto_generate_cover_letter_on_job_add: payload.generateCoverLetter,
  }

  const { error } = await supabase
    .from("profiles")
    .update({ preferences: updated as unknown as Json })
    .eq("id", user.id)

  if (error) return { error: error.message }
  revalidatePath("/profile")
  return { success: true }
}
