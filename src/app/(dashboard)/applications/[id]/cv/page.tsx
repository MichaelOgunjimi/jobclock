import { notFound, permanentRedirect, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { AppWithJob, CvData } from "@/lib/supabase/database.types"
import type { Metadata } from "next"
import { CvPreviewClient } from "./cv-preview-client"
import { applicationPath } from "@/lib/applications/path"
import { resolveApplicationRoute } from "@/lib/applications/route"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  if (!isSupabaseConfigured()) return { title: "Tailored CV" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { title: "Tailored CV" }
  const route = await resolveApplicationRoute(user.id, id)
  if (!route) return { title: "Tailored CV" }
  const { data } = await supabase
    .from("applications")
    .select("jobs_cache(title, company)")
    .eq("id", route.id)
    .eq("user_id", user.id)
    .maybeSingle()
  const job = (data as { jobs_cache: { title?: string; company?: string } | null } | null)?.jobs_cache
  const suffix = job?.title && job?.company
    ? `${job.title} · ${job.company}`
    : job?.title ?? null
  return { title: suffix ? `Tailored CV — ${suffix}` : "Tailored CV" }
}

export default async function CvPreviewPage({
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

  const route = await resolveApplicationRoute(user.id, id)
  if (!route) notFound()
  if (id !== route.slug) permanentRedirect(applicationPath(route.slug, "/cv"))
  const applicationId = route.id

  const [
    { data: cvData },
    { data: profile },
    { data: application },
    { data: coverLetterExists },
  ] = await Promise.all([
    supabase
      .from("customized_cvs")
      .select("id, cv_json, ats_score, created_at, skills_gap")
      .eq("application_id", applicationId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .single(),
    supabase
      .from("applications")
      .select("*, jobs_cache (*)")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("cover_letters")
      .select("id")
      .eq("application_id", applicationId)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  ])

  if (!cvData?.cv_json) notFound()

  const prefs = (profile?.preferences ?? {}) as Record<string, unknown>
  const initialTemplate = (prefs.preferred_cv_template as string) ?? "modern"
  const job = (application as unknown as AppWithJob | null)?.jobs_cache

  return (
    <CvPreviewClient
      customizedCvId={cvData.id}
      cvData={cvData.cv_json as unknown as CvData}
      applicationId={applicationId}
      applicationSlug={route.slug}
      atsScore={cvData.ats_score}
      generatedAt={cvData.created_at}
      initialTemplate={initialTemplate as "classic" | "modern" | "sidebar"}
      skillsGap={cvData.skills_gap}
      jobTitle={job?.title ?? null}
      jobCompany={job?.company ?? null}
      jobUrl={job?.url ?? null}
      hasCoverLetter={Boolean(coverLetterExists)}
    />
  )
}
