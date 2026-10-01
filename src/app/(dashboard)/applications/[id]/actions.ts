"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { enqueueGeneration } from "@/lib/generation/enqueue"
import { updateApplicationStatusForUser } from "@/lib/jobs/persist-job"
import {
  deleteApplicationWithAuditForUser,
  updateApplicationWithAuditForUser,
} from "@/lib/applications/audit"
import {
  isApplicationStatus,
  type ApplicationStatusIntent,
} from "@/lib/applications/status-transitions"
import { z } from "zod"

const VALID_STATUS_INTENTS = new Set<ApplicationStatusIntent>(["progress", "correction", "reopen"])

const jobDetailSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("title"), value: z.string().trim().min(1, "Role is required").max(200) }),
  z.object({ field: z.literal("company"), value: z.string().trim().min(1, "Company is required").max(200) }),
  z.object({ field: z.literal("location"), value: z.string().trim().max(200) }),
  z.object({ field: z.literal("salary"), value: z.string().trim().max(120) }),
])

const jobDetailColumns = {
  title: "custom_title",
  company: "custom_company",
  location: "custom_location",
  salary: "custom_salary_text",
} as const

export async function updateStatus(formData: FormData) {
  if (!isSupabaseConfigured()) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const applicationId = formData.get("applicationId") as string
  const status = formData.get("status")
  const intent = formData.get("intent") ?? "progress"

  if (
    !applicationId ||
    !isApplicationStatus(status) ||
    typeof intent !== "string" ||
    !VALID_STATUS_INTENTS.has(intent as ApplicationStatusIntent)
  ) return

  await updateApplicationStatusForUser(
    user.id,
    applicationId,
    status,
    intent as ApplicationStatusIntent
  )

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

  await updateApplicationWithAuditForUser(
    user.id,
    applicationId,
    { notes },
    "application.notes_updated",
  )

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

  await updateApplicationWithAuditForUser(
    user.id,
    applicationId,
    { selectedCvId: cvId || null },
    "application.cv_selected",
  )

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

  await updateApplicationWithAuditForUser(
    user.id,
    applicationId,
    { coverLetterId: coverLetterId || null },
    "application.cover_letter_selected",
  )

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

  await updateApplicationWithAuditForUser(
    user.id,
    applicationId,
    {
      structureId: structureId || null,
      coverLetterTone: tone || null,
    },
    "application.writing_style_updated",
  )

  revalidatePath(`/applications/${applicationId}`)
}

export async function deleteApplication(applicationId: string) {
  if (!isSupabaseConfigured()) return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  await deleteApplicationWithAuditForUser(user.id, applicationId)

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

  try {
    const updated = await updateApplicationWithAuditForUser(
      user.id,
      applicationId,
      { customDescription: description },
      "application.description_updated",
    )
    if (!updated) return { error: "Application not found" }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update description" }
  }

  revalidatePath(`/applications/${applicationId}`)
  return { success: true }
}

export async function updateJobDetail(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const applicationId = formData.get("applicationId")
  const field = formData.get("field")
  const useExtracted = formData.get("useExtracted") === "true"
  if (typeof applicationId !== "string" || !applicationId) {
    return { error: "Missing application ID" }
  }
  if (typeof field !== "string" || !(field in jobDetailColumns)) {
    return { error: "Invalid job detail field" }
  }

  let value: string | null = null
  if (!useExtracted) {
    const parsed = jobDetailSchema.safeParse({ field, value: formData.get("value") })
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid value" }
    }
    value = parsed.data.value
  }

  const fieldName = {
    title: "customTitle",
    company: "customCompany",
    location: "customLocation",
    salary: "customSalaryText",
  }[field as keyof typeof jobDetailColumns] as
    | "customTitle"
    | "customCompany"
    | "customLocation"
    | "customSalaryText"
  try {
    const updated = await updateApplicationWithAuditForUser(
      user.id,
      applicationId,
      { [fieldName]: value },
      "application.details_updated",
    )
    if (!updated) return { error: "Application not found" }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update job detail" }
  }

  revalidatePath(`/applications/${applicationId}`)
  revalidatePath("/applications")
  return { success: true }
}

// ── AI: Generate cover letter ─────────────────────────────────────────────────

export async function generateCoverLetter(
  applicationId: string
): Promise<{ error?: string; jobId?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated." }

  const result = await enqueueGeneration({ kind: "cover_letter", userId: user.id, applicationId })
  if ("error" in result) return { error: result.error }
  return { jobId: result.jobId }
}

export async function updateFollowUp(applicationId: string, data: {
  followUpDueAt: string | null
  followUpNotes: string | null
}): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  await updateApplicationWithAuditForUser(
    user.id,
    applicationId,
    {
      followUpDueAt: data.followUpDueAt ? new Date(data.followUpDueAt) : null,
      followUpNotes: data.followUpNotes ?? null,
    },
    "application.follow_up_updated",
  )

  revalidatePath(`/applications/${applicationId}`)
  return {}
}
