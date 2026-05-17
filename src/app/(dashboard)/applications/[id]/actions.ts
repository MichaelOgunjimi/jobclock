"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications } from "@/lib/db/schema"
import type { ApplicationStatus } from "@/lib/supabase/database.types"
import { enqueueGeneration } from "@/lib/generation/enqueue"

const VALID_STATUSES = new Set<ApplicationStatus>([
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
])

export async function updateStatus(formData: FormData) {
  if (!isSupabaseConfigured()) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const applicationId = formData.get("applicationId") as string
  const status = formData.get("status") as string

  if (!applicationId || !VALID_STATUSES.has(status as ApplicationStatus)) return

  const updates: {
    status: ApplicationStatus
    last_status_update: string
    applied_at?: string
  } = {
    status: status as ApplicationStatus,
    last_status_update: new Date().toISOString(),
  }

  // Only set applied_at on the transition to "applied" — fetch current status first
  if (status === "applied") {
    const { data: current } = await supabase
      .from("applications")
      .select("applied_at")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single()

    if (current && !current.applied_at) {
      updates.applied_at = new Date().toISOString()
    }
  }

  await supabase
    .from("applications")
    .update(updates)
    .eq("id", applicationId)
    .eq("user_id", user.id)

  revalidatePath(`/applications/${applicationId}`)
  revalidatePath("/applications")
}

export async function updateNotes(formData: FormData) {
  if (!isSupabaseConfigured()) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const applicationId = formData.get("applicationId") as string
  const notes = formData.get("notes") as string

  if (!applicationId) return

  await supabase
    .from("applications")
    .update({ notes })
    .eq("id", applicationId)
    .eq("user_id", user.id)

  revalidatePath(`/applications/${applicationId}`)
}

export async function updateCv(formData: FormData) {
  if (!isSupabaseConfigured()) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const applicationId = formData.get("applicationId") as string
  const cvId = formData.get("cvId") as string

  if (!applicationId) return

  await supabase
    .from("applications")
    .update({ selected_cv_id: cvId || null })
    .eq("id", applicationId)
    .eq("user_id", user.id)

  revalidatePath(`/applications/${applicationId}`)
}

export async function updateCoverLetter(formData: FormData) {
  if (!isSupabaseConfigured()) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const applicationId = formData.get("applicationId") as string
  const coverLetterId = formData.get("coverLetterId") as string

  if (!applicationId) return

  await supabase
    .from("applications")
    .update({ cover_letter_id: coverLetterId || null })
    .eq("id", applicationId)
    .eq("user_id", user.id)

  revalidatePath(`/applications/${applicationId}`)
}

export async function updateWritingStyle(formData: FormData) {
  if (!isSupabaseConfigured()) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const applicationId = formData.get("applicationId") as string
  const structureId = formData.get("structureId") as string | null
  const tone = formData.get("tone") as string | null

  if (!applicationId) return

  await supabase
    .from("applications")
    .update({
      structure_id: structureId || null,
      cover_letter_tone: (tone || null) as "professional" | "enthusiastic" | "conservative" | "story" | null,
    })
    .eq("id", applicationId)
    .eq("user_id", user.id)

  revalidatePath(`/applications/${applicationId}`)
}

export async function deleteApplication(applicationId: string) {
  if (!isSupabaseConfigured()) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from("applications")
    .delete()
    .eq("id", applicationId)
    .eq("user_id", user.id)

  revalidatePath("/applications")
  redirect("/applications")
}

export async function updateDescription(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const applicationId = formData.get("applicationId") as string
  const description = formData.get("description") as string
  if (!applicationId) return { error: "Missing application ID" }

  const { error } = await supabase
    .from("applications")
    .update({ custom_description: description })
    .eq("id", applicationId)
    .eq("user_id", user.id)

  if (error) return { error: error.message }

  revalidatePath(`/applications/${applicationId}`)
  return { success: true }
}

// ── AI: Generate cover letter ─────────────────────────────────────────────────

export async function generateCoverLetter(
  applicationId: string
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated." }

  const result = await enqueueGeneration({ kind: "cover_letter", userId: user.id, applicationId })
  if ("error" in result) return { error: result.error }
  return {}
}

export async function updateFollowUp(applicationId: string, data: {
  followUpDueAt: string | null
  followUpNotes: string | null
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  await db
    .update(applications)
    .set({
      followUpDueAt: data.followUpDueAt ? new Date(data.followUpDueAt) : null,
      followUpNotes: data.followUpNotes ?? null,
    })
    .where(and(eq(applications.id, applicationId), eq(applications.userId, user.id)))

  revalidatePath(`/applications/${applicationId}`)
  return {}
}
