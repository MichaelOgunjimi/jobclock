import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { loadInterviewWorkspace } from "./data"
import { InterviewWorkspace } from "./interview-workspace"

export const metadata: Metadata = {
  title: "Interview Prep",
}

export default async function InterviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ applicationId?: string }>
}) {
  if (!isSupabaseConfigured()) redirect("/auth")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const workspace = await loadInterviewWorkspace(user.id, resolvedSearchParams?.applicationId)

  return (
    <div className="page-shell max-w-6xl gap-6 py-5 md:gap-8 md:py-8 lg:min-h-0 lg:flex-1">
      <div className="page-header gap-3 pb-5 md:pb-6">
        <div className="space-y-3">
          <p className="page-kicker">Interview Prep</p>
          <div className="space-y-2">
            <h1 className="page-title">Practise from your own evidence.</h1>
            <p className="page-lede max-w-2xl">
              Build full answers, tailor them to a current application, and
              practise without pretending you have experiences you do not have.
            </p>
          </div>
        </div>
      </div>

      <InterviewWorkspace initial={workspace} />
    </div>
  )
}
