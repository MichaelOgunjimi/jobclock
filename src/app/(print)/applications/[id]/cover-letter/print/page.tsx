import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import type { CoverLetterRenderData, CvData } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { CoverLetterPaper } from "@/components/cover-letter/document/cover-letter-paper"
import {
  isCoverLetterTemplateName,
  type CoverLetterTemplateName,
} from "@/components/cover-letter/templates/cover-letter-template-renderer"
import { AutoPrint } from "@/app/(print)/auto-print"

export const dynamic = "force-dynamic"

export default async function ApplicationCoverLetterPrintPage({
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

  const [{ data: coverLetter }, { data: profile }, { data: application }] =
    await Promise.all([
      supabase
        .from("cover_letters")
        .select("id, content, tone, label, created_at")
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
      supabase
        .from("applications")
        .select("selected_cv_id, jobs_cache(title, company)")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
    ])

  if (!coverLetter?.content) notFound()

  const typedApplication = application as
    | {
        selected_cv_id: string | null
        jobs_cache: { title: string; company: string } | null
      }
    | null

  let senderCv: CvData | null = null

  if (typedApplication?.selected_cv_id) {
    const { data: selectedCv } = await supabase
      .from("user_cvs")
      .select("parsed_json")
      .eq("id", typedApplication.selected_cv_id)
      .eq("user_id", user.id)
      .maybeSingle()

    senderCv = (selectedCv?.parsed_json as CvData | null) ?? null
  }

  if (!senderCv) {
    const { data: latestUserCv } = await supabase
      .from("user_cvs")
      .select("parsed_json")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    senderCv = (latestUserCv?.parsed_json as CvData | null) ?? null
  }

  if (!senderCv) {
    const { data: primaryUserCv } = await supabase
      .from("user_cvs")
      .select("parsed_json")
      .eq("user_id", user.id)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle()

    senderCv = (primaryUserCv?.parsed_json as CvData | null) ?? null
  }

  const preferences = (profile?.preferences ?? {}) as Record<string, unknown>
  const preferredTemplate = preferences.preferred_cover_letter_template as
    | string
    | undefined
  const queryTemplate = resolvedSearchParams.template

  const template: CoverLetterTemplateName = isCoverLetterTemplateName(queryTemplate)
    ? queryTemplate
    : isCoverLetterTemplateName(preferredTemplate)
      ? preferredTemplate
      : "modern"

  const renderData: CoverLetterRenderData = {
    content: coverLetter.content,
    sender: {
      name: senderCv?.name,
      email: senderCv?.email,
      phone: senderCv?.phone,
      location: senderCv?.location,
      linkedin: senderCv?.linkedin,
      website: senderCv?.website,
    },
    recipient: {
      company: typedApplication?.jobs_cache?.company ?? undefined,
      jobTitle: typedApplication?.jobs_cache?.title ?? undefined,
    },
    date: new Date(coverLetter.created_at ?? "1970-01-01").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  }

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
        <CoverLetterPaper
          data={renderData}
          template={template}
          className="mx-auto"
          includeShadow={false}
        />
      </main>
    </>
  )
}
