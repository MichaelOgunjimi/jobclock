import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import type { CvData } from "@/lib/supabase/database.types"
import type { Metadata } from "next"
import { CvPreviewClient } from "./cv-preview-client"

export const metadata: Metadata = { title: "CV Preview" }

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

  const [{ data: cvData }, { data: profile }] = await Promise.all([
    supabase
      .from("customized_cvs")
      .select("id, cv_json, ats_score, created_at, skills_gap")
      .eq("application_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .single(),
  ])

  if (!cvData?.cv_json) notFound()

  const prefs = (profile?.preferences ?? {}) as Record<string, unknown>
  const initialTemplate = (prefs.preferred_cv_template as string) ?? "modern"

  return (
    <CvPreviewClient
      customizedCvId={cvData.id}
      cvData={cvData.cv_json as unknown as CvData}
      applicationId={id}
      atsScore={cvData.ats_score}
      generatedAt={cvData.created_at}
      initialTemplate={initialTemplate as "classic" | "modern" | "sidebar"}
      skillsGap={cvData.skills_gap}
    />
  )
}
