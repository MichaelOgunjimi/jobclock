import { notFound, permanentRedirect, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { applicationPath } from "@/lib/applications/path"
import { resolveApplicationRoute } from "@/lib/applications/route"

export default async function InterviewPrepRedirectPage({
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
  if (id !== route.slug) {
    permanentRedirect(applicationPath(route.slug, "/interview"))
  }

  redirect(`/interview?application=${route.slug}`)
}
