"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { ApplicationStatus } from "@/lib/supabase/database.types"

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
    .update({ customized_cv_id: cvId || null })
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

export async function updateDescription(formData: FormData) {
  if (!isSupabaseConfigured()) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const applicationId = formData.get("applicationId") as string
  const description = formData.get("description") as string
  if (!applicationId) return

  // Verify ownership via applications table
  const { data: app } = await supabase
    .from("applications")
    .select("job_id")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single()
  if (!app?.job_id) return

  await supabase
    .from("jobs_cache")
    .update({ description })
    .eq("id", app.job_id)

  revalidatePath(`/applications/${applicationId}`)
}
