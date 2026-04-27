import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { listStories } from "./actions"
import { StoryBank } from "./story-bank"

export const metadata: Metadata = {
  title: "Interview Prep",
}

export default async function InterviewPage() {
  if (!isSupabaseConfigured()) redirect("/auth")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  const stories = await listStories()

  return (
    <div className="page-shell max-w-4xl gap-6 py-5 md:gap-8 md:py-8 lg:min-h-0 lg:flex-1">
      <div className="page-header gap-3 pb-5 md:pb-6">
        <div className="space-y-3">
          <p className="page-kicker">Interview</p>
          <div className="space-y-2">
            <h1 className="page-title">Story bank.</h1>
            <p className="page-lede max-w-2xl">
              Build a library of STAR-format stories you can draw on when preparing for interviews. Each story can be tagged by competency and mapped to likely questions.
            </p>
          </div>
        </div>
      </div>

      <StoryBank initial={stories} />
    </div>
  )
}
