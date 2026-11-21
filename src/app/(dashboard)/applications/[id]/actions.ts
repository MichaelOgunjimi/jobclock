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
import {
  archiveApplicationForUser,
  restoreApplicationForUser,
  setApplicationAppliedAtForUser,
  setApplicationSourceForUser,
  setApplicationTagsForUser,
  type ManageResult,
} from "@/lib/applications/manage"
import { interviewAtSchema } from "@/lib/applications/interview-at"
import { JOB_DETAIL_FIELDS, jobDetailSchema } from "@/lib/applications/job-detail"

const VALID_STATUS_INTENTS = new Set<ApplicationStatusIntent>(["progress", "correction", "reopen"])


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
  if (typeof field !== "string" || !(field in JOB_DETAIL_FIELDS)) {
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

  const fieldName = JOB_DETAIL_FIELDS[field as keyof typeof JOB_DETAIL_FIELDS]
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

/** `interviewAt` is a UTC ISO instant, or null to clear the date. */
export async function updateInterviewAt(
  applicationId: string,
  interviewAt: string | null,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }
  if (!applicationId) return { error: "Missing application ID" }

  let value: Date | null = null
  if (interviewAt !== null) {
    const parsed = interviewAtSchema.safeParse(interviewAt)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid date" }
    value = new Date(parsed.data)
  }

  try {
    const updated = await updateApplicationWithAuditForUser(
      user.id,
      applicationId,
      { interviewAt: value },
      "application.interview_scheduled",
    )
    if (!updated) return { error: "Application not found" }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update interview date" }
  }

  revalidatePath(`/applications/${applicationId}`)
  return {}
}

// ── Archive, tags, source and applied date ────────────────────────────────────

async function manage(
  applicationId: string,
  run: (userId: string) => Promise<ManageResult>,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }
  if (!applicationId) return { error: "Missing application ID" }

  let result: ManageResult
  try {
    result = await run(user.id)
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save the change" }
  }
  if (!result) return { error: "Application not found" }
  if ("error" in result) return { error: result.error }

  revalidatePath(`/applications/${applicationId}`)
  revalidatePath("/applications")
  revalidatePath("/dashboard")
  return {}
}

export async function archiveApplication(applicationId: string) {
  return manage(applicationId, (userId) => archiveApplicationForUser(userId, applicationId))
}

export async function restoreApplication(applicationId: string) {
  return manage(applicationId, (userId) => restoreApplicationForUser(userId, applicationId))
}

export async function updateTags(applicationId: string, tags: string[]) {
  return manage(applicationId, (userId) => setApplicationTagsForUser(userId, applicationId, tags))
}

export async function updateSource(applicationId: string, source: string | null) {
  return manage(applicationId, (userId) => setApplicationSourceForUser(userId, applicationId, source))
}

/** `appliedAt` is `YYYY-MM-DD`, or null to clear the date. */
export async function updateAppliedAt(applicationId: string, appliedAt: string | null) {
  return manage(applicationId, (userId) => setApplicationAppliedAtForUser(userId, applicationId, appliedAt))
}
