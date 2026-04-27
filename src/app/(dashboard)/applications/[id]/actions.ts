"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { resolveAiConfig, generateText } from "@/lib/ai"
import { aiGenerateRateLimit } from "@/lib/rate-limit"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications } from "@/lib/db/schema"
import type { ApplicationStatus, AppWithJob, CvData } from "@/lib/supabase/database.types"
import type { AiSettings, UserPreferences } from "@/lib/ai"
import {
  buildCoverLetterSystemPrompt,
  buildCoverLetterUserPrompt,
} from "@/lib/ai/prompts"

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

// ── AI helpers ────────────────────────────────────────────────────────────────

async function resolveApplicationContext(
  applicationId: string
): Promise<
  | { error: string }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>
      user: { id: string }
      app: AppWithJob
      profileData: { preferences?: unknown } | null
      description: string
    }
> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured." }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated." }

  const [{ data: appData }, { data: profileData }] = await Promise.all([
    supabase
      .from("applications")
      .select("*, jobs_cache (*)")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .single(),
  ])

  if (!appData) return { error: "Application not found." }
  const app = appData as unknown as AppWithJob

  const description = app.custom_description ?? app.jobs_cache?.description
  if (!description?.trim()) {
    return { error: "No job description found. Add one first." }
  }

  return { supabase, user: { id: user.id }, app, profileData, description }
}


function buildCvContext(cv: CvData | null): string {
  if (!cv) return ""
  const parts: string[] = []

  if (cv.skills?.length) {
    parts.push(`Skills: ${cv.skills.join(", ")}`)
  }

  if (cv.experience?.length) {
    const expLines = cv.experience.map((e) => {
      let line = `- ${e.title} at ${e.company}`
      if (e.start_date || e.end_date) {
        line += ` (${[e.start_date, e.end_date ?? "Present"].filter(Boolean).join(" – ")})`
      }
      if (e.highlights?.length) line += `\n  Key achievements: ${e.highlights.join("; ")}`
      return line
    })
    parts.push(`Experience:\n${expLines.join("\n")}`)
  }

  if (cv.education?.length) {
    const eduLines = cv.education.map((e) => {
      let line = `- ${e.degree}${e.field ? ` in ${e.field}` : ""} — ${e.institution}`
      if (e.gpa) line += ` (GPA: ${e.gpa})`
      if (e.honors) line += ` (${e.honors})`
      return line
    })
    parts.push(`Education:\n${eduLines.join("\n")}`)
  }

  if (cv.projects?.length) {
    const projLines = cv.projects.map((p) => {
      let line = `- ${p.name}: ${p.description}`
      if (p.highlights?.length) line += ` — ${p.highlights.join("; ")}`
      return line
    })
    parts.push(`Projects:\n${projLines.join("\n")}`)
  }

  if (cv.certifications?.length) {
    parts.push(`Certifications: ${cv.certifications.join(", ")}`)
  }

  if (cv.languages?.length) {
    parts.push(`Languages: ${cv.languages.join(", ")}`)
  }

  return parts.join("\n\n")
}

// ── AI: Generate cover letter ─────────────────────────────────────────────────

export async function generateCoverLetter(
  applicationId: string
): Promise<{ error?: string; success?: boolean }> {
  const context = await resolveApplicationContext(applicationId)
  if ("error" in context) return { error: context.error }
  const { supabase, user, app, profileData, description } = context

  const { success: withinLimit } = await aiGenerateRateLimit.limit(user.id)
  if (!withinLimit) {
    return { error: "Rate limit reached. Please wait a moment before trying again." }
  }

  const job = app.jobs_cache

  // Resolve base CV and writing style in parallel
  let baseCvId: string | null = app.selected_cv_id ?? null
  if (!baseCvId) {
    const { data: primaryCv } = await supabase
      .from("user_cvs")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_primary", true)
      .maybeSingle()
    baseCvId = primaryCv?.id ?? null
  }

  // Resolve writing style: use the one linked to the application, or fall back to the Professional built-in
  const structureId = app.structure_id ?? null
  const structureQuery = structureId
    ? supabase
        .from("cover_letter_structures")
        .select("content, default_tone")
        .eq("id", structureId)
        .maybeSingle()
    : supabase
        .from("cover_letter_structures")
        .select("content, default_tone")
        .eq("is_built_in", true)
        .eq("slug", "professional")
        .maybeSingle()

  const [cvResult, structureResult] = await Promise.all([
    baseCvId
      ? supabase
          .from("user_cvs")
          .select("parsed_json")
          .eq("id", baseCvId)
          .single()
      : Promise.resolve({ data: null }),
    structureQuery,
  ])

  const cvParsed = cvResult.data?.parsed_json as CvData | null
  const structure = structureResult.data as { content?: string; default_tone?: string | null } | null

  // Tone: use the override stored on the application, then structure default, then "professional"
  const resolvedTone = (app.cover_letter_tone ?? structure?.default_tone ?? "professional") as
    | "professional"
    | "enthusiastic"
    | "conservative"
    | "story"

  // Resolve AI settings and API key
  const preferences = (profileData?.preferences ?? {}) as UserPreferences
  let settings: AiSettings
  let apiKey: string
  try {
    const resolved = resolveAiConfig(preferences)
    settings = resolved.settings
    apiKey = resolved.apiKey
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No API key configured." }
  }

  const toneInstruction = `Write in a ${resolvedTone} tone.`
  const systemPrompt = buildCoverLetterSystemPrompt(toneInstruction)

  const cvContext = buildCvContext(cvParsed)
  const templateSnippet = structure?.content ?? ""

  const userPrompt = buildCoverLetterUserPrompt({
    title: job?.title ?? "the role",
    company: job?.company ?? "the company",
    description,
    cvContext,
    templateSnippet,
  })

  let content: string
  try {
    content = await generateText(settings, apiKey, systemPrompt, userPrompt)
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI generation failed." }
  }

  // Insert new generated cover letter, returning ID directly to avoid race conditions
  const { data: newLetter, error: insertError } = await supabase.from("cover_letters").insert({
    user_id: user.id,
    application_id: applicationId,
    label: `AI — ${job?.title ?? "Application"} at ${job?.company ?? "Company"}`,
    content: content.trim(),
    tone: resolvedTone,
  }).select("id").single()

  if (insertError) return { error: insertError.message }

  // Delete old generated cover letters only after successful insert
  if (newLetter?.id) {
    await supabase
      .from("cover_letters")
      .delete()
      .eq("application_id", applicationId)
      .eq("user_id", user.id)
      .neq("id", newLetter.id)
  }

  revalidatePath(`/applications/${applicationId}`)
  return { success: true }
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
