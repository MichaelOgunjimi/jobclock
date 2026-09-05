import { notFound, permanentRedirect, redirect } from "next/navigation"
import { Suspense } from "react"
import type { CvData } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { CvPaper } from "@/components/cv/document/cv-paper"
import {
  isCvTemplateName,
  type CvTemplateName,
} from "@/components/cv/templates/cv-template-renderer"
import { AutoPrint } from "@/app/(print)/auto-print"
import { applicationPath } from "@/lib/applications/path"
import { resolveApplicationRoute } from "@/lib/applications/route"

export const dynamic = "force-dynamic"

export default async function ApplicationCvPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ template?: string }>
}) {
  if (!isSupabaseConfigured()) redirect("/auth")

  const [{ id }, resolvedSearchParams] = await Promise.all([params, searchParams])

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/auth")

  const route = await resolveApplicationRoute(user.id, id)
  if (!route) notFound()
  if (id !== route.slug) permanentRedirect(applicationPath(route.slug, "/cv/print"))
  const applicationId = route.id

  const [{ data: cvRow }, { data: profile }] = await Promise.all([
    supabase
      .from("customized_cvs")
      .select("cv_json")
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
  ])

  if (!cvRow?.cv_json) notFound()

  const preferences = (profile?.preferences ?? {}) as Record<string, unknown>
  const preferredTemplate = preferences.preferred_cv_template as string | undefined
  const queryTemplate = resolvedSearchParams.template

  const template: CvTemplateName = isCvTemplateName(queryTemplate)
    ? queryTemplate
    : isCvTemplateName(preferredTemplate)
      ? preferredTemplate
      : "modern"

  return (
    <>
      <style>{`
        @page {
          size: A4;
          margin: 0;
        }

        html, body {
          margin: 0;
          padding: 0;
          background: white;
        }

        body {
          min-height: auto;
        }
      `}</style>
      <Suspense>
        <AutoPrint />
      </Suspense>
      <main className="bg-white">
        <CvPaper
          cv={cvRow.cv_json as unknown as CvData}
          template={template}
          className="mx-auto"
          includeShadow={false}
        />
      </main>
    </>
  )
}
