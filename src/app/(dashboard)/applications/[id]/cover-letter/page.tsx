import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { CvData } from "@/lib/supabase/database.types"
import type { Metadata } from "next"
import { CoverLetterPreviewClient } from "./cover-letter-preview-client"

export const metadata: Metadata = { title: "Cover Letter Preview" }

export default async function CoverLetterPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!isSupabaseConfigured()) redirect("/auth")
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  // Fetch application (with job data), generated cover letter, user CV, and profile
  const [{ data: app }, { data: profile }] = await Promise.all([
    supabase
      .from("applications")
      .select("*, jobs_cache(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .single(),
  ])

  if (!app) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typedApp = app as any as {
    selected_cv_id: string | null
    jobs_cache: { title?: string; company?: string } | null
  }

  // Get the generated cover letter for this application
  const { data: coverLetter } = await supabase
    .from("cover_letters")
    .select("id, content, tone, label, created_at")
    .eq("application_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!coverLetter) notFound()

  // Get user's CV for sender header info
  const cvId = typedApp.selected_cv_id
  const { data: cvRow } = cvId
    ? await supabase
        .from("user_cvs")
        .select("parsed_json, name")
        .eq("id", cvId)
        .eq("user_id", user.id)
        .single()
    : { data: null }

  // If no linked CV, try primary
  let cvData: CvData | null = cvRow?.parsed_json as CvData | null
  if (!cvData) {
    const { data: primaryCv } = await supabase
      .from("user_cvs")
      .select("parsed_json")
      .eq("user_id", user.id)
      .eq("is_primary", true)
      .maybeSingle()
    cvData = primaryCv?.parsed_json as CvData | null
  }

  const job = typedApp.jobs_cache
  const prefs = (profile?.preferences ?? {}) as Record<string, unknown>
  const initialTemplate =
    (prefs.preferred_cover_letter_template as string) ?? "modern"

  return (
    <CoverLetterPreviewClient
      applicationId={id}
      coverLetterId={coverLetter.id}
      content={coverLetter.content}
      tone={coverLetter.tone}
      generatedAt={coverLetter.created_at ?? new Date().toISOString()}
      senderCv={cvData}
      jobTitle={job?.title ?? null}
      jobCompany={job?.company ?? null}
      initialTemplate={initialTemplate}
    />
  )
}
