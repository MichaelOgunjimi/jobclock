import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { Database } from "@/lib/supabase/database.types"
import { ApplicationDetail } from "./application-detail"

type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"]
type JobsCacheRow = Database["public"]["Tables"]["jobs_cache"]["Row"]

type ApplicationWithJob = ApplicationRow & {
  jobs_cache: JobsCacheRow | null
}

export default async function ApplicationDetailPage({
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

  // Fetch application with full jobs_cache join
  const { data: applicationData } = await supabase
    .from("applications")
    .select(`
      *,
      jobs_cache (*)
    `)
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (!applicationData) notFound()

  const application = applicationData as ApplicationWithJob

  const [
    { data: cvsData },
    { data: coverLettersData },
    { data: tailoredCvsData },
    { data: generatedCoverLetterData },
  ] = await Promise.all([
    supabase
      .from("user_cvs")
      .select("id, name, is_primary, created_at")
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("cover_letters")
      .select("id, label, tone")
      .eq("user_id", user.id)
      .is("application_id", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("customized_cvs")
      .select("id, cv_json, skills_gap, ats_score, created_at")
      .eq("application_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("cover_letters")
      .select("id, content, tone, label, created_at")
      .eq("application_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const cvs = cvsData ?? []
  const coverLetters = coverLettersData ?? []

  return (
    <ApplicationDetail
      application={application}
      cvs={cvs}
      coverLetters={coverLetters}
      tailoredCvs={tailoredCvsData ?? []}
      generatedCoverLetter={generatedCoverLetterData ?? null}
    />
  )
}
