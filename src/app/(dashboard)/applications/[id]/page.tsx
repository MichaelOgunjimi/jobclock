import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { eq, and } from "drizzle-orm"
import { db } from "@/lib/db"
import { applications } from "@/lib/db/schema"
import type { Database } from "@/lib/supabase/database.types"
import { ApplicationDetail } from "./application-detail"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  if (!isSupabaseConfigured()) return { title: "Application" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { title: "Application" }
  const { data } = await supabase
    .from("applications")
    .select("custom_title, custom_company, jobs_cache(title, company)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()
  const record = data as {
    custom_title: string | null
    custom_company: string | null
    jobs_cache: { title?: string; company?: string } | null
  } | null
  const role = record?.custom_title ?? record?.jobs_cache?.title
  const company = record?.custom_company ?? record?.jobs_cache?.company
  const title = role && company ? `${role} · ${company}` : role ?? "Application"
  return { title }
}


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
    { data: writingStylesData },
    { data: tailoredCvsData },
    { data: generatedCoverLetterData },
    followUpData,
  ] = await Promise.all([
    supabase
      .from("user_cvs")
      .select("id, name, is_primary, created_at")
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("cover_letter_structures")
      .select("id, label, default_tone, is_built_in")
      .or(`is_built_in.eq.true,user_id.eq.${user.id}`)
      .order("is_built_in", { ascending: false })
      .order("created_at", { ascending: true }),
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
    db
      .select({ followUpDueAt: applications.followUpDueAt, followUpNotes: applications.followUpNotes })
      .from(applications)
      .where(and(eq(applications.id, id), eq(applications.userId, user.id)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ])

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <ApplicationDetail
        application={application}
        cvs={cvsData ?? []}
        writingStyles={writingStylesData ?? []}
        tailoredCvs={tailoredCvsData ?? []}
        generatedCoverLetter={generatedCoverLetterData ?? null}
        followUpDueAt={followUpData?.followUpDueAt?.toISOString() ?? null}
        followUpNotes={followUpData?.followUpNotes ?? null}
      />
    </div>
  )
}
