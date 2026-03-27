"use server"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { revalidatePath } from "next/cache"
import type { CvData, Json } from "@/lib/supabase/database.types"

export async function setPrimaryCV(formData: FormData) {
  if (!isSupabaseConfigured()) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const cvId = formData.get("cvId") as string

  // Unset all primary, then set the chosen one
  await supabase.from("user_cvs").update({ is_primary: false }).eq("user_id", user.id)
  await supabase.from("user_cvs").update({ is_primary: true }).eq("id", cvId).eq("user_id", user.id)

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

export async function saveLetterTemplate(formData: FormData) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const id = formData.get("id") as string | null
  const label = (formData.get("label") as string).trim()
  const content = (formData.get("content") as string).trim()
  const tone = (formData.get("tone") as string | null) || null

  if (!label || !content) return { error: "Label and content are required" }

  type Tone = "professional" | "enthusiastic" | "conservative" | "story" | null
  const toneCast = tone as Tone

  if (id) {
    const { data, error } = await supabase
      .from("cover_letters")
      .update({ label, content, tone: toneCast })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, label, content, tone")
      .single()
    if (error) return { error: error.message }
    revalidatePath("/profile")
    return { success: true, letter: data }
  } else {
    const { data, error } = await supabase
      .from("cover_letters")
      .insert({ user_id: user.id, label, content, tone: toneCast, application_id: null })
      .select("id, label, content, tone")
      .single()
    if (error) return { error: error.message }
    revalidatePath("/profile")
    return { success: true, letter: data }
  }
}

export async function deleteLetterTemplate(formData: FormData) {
  if (!isSupabaseConfigured()) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const id = formData.get("id") as string
  await supabase.from("cover_letters").delete().eq("id", id).eq("user_id", user.id).is("application_id", null)

  revalidatePath("/profile")
}

export async function savePreferences(formData: FormData) {
  if (!isSupabaseConfigured()) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const rolesRaw = (formData.get("desired_roles") as string).trim()
  const desiredRoles = rolesRaw ? rolesRaw.split(",").map((r) => r.trim()).filter(Boolean) : []
  const locationUk = (formData.get("location_uk") as string).trim() || null
  const salaryRaw = formData.get("target_salary_min") as string
  const targetSalaryMin = salaryRaw ? Number(salaryRaw) : null
  const rightToWorkUk = formData.get("right_to_work_uk") === "on"

  await supabase
    .from("profiles")
    .update({
      desired_roles: desiredRoles,
      location_uk: locationUk,
      target_salary_min: targetSalaryMin,
      right_to_work_uk: rightToWorkUk,
    })
    .eq("id", user.id)

  revalidatePath("/profile")
}
