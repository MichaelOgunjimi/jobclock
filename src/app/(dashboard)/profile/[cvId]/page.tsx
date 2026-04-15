import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { redirect, notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"
import type { CvData } from "@/lib/supabase/database.types"
import { normalizeCvData } from "@/lib/cv-data"
import { CvEditor } from "./cv-editor"
import { setPrimaryCV as setPrimaryCVAction } from "../actions"

export default async function CvDetailPage({
  params,
}: {
  params: Promise<{ cvId: string }>
}) {
  if (!isSupabaseConfigured()) redirect("/auth")

  const { cvId } = await params

  async function setPrimaryCV(formData: FormData) {
    "use server"
    await setPrimaryCVAction(formData)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  const { data: cv } = await supabase
    .from("user_cvs")
    .select("*")
    .eq("id", cvId)
    .eq("user_id", user.id)
    .single()

  if (!cv) notFound()

  const cvData = normalizeCvData(cv.parsed_json as CvData | null)

  return (
    <div className="page-shell max-w-4xl">
      <div className="page-header">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="page-title">{cv.name ?? cvData.name ?? "Untitled CV"}</h1>
            {cv.is_primary && (
              <Badge variant="secondary" className="text-[10px]">
                <Star className="h-2.5 w-2.5 mr-1" />
                Primary
              </Badge>
            )}
          </div>
        </div>

        {!cv.is_primary && (
          <form action={setPrimaryCV}>
            <input type="hidden" name="cvId" value={cv.id} />
            <Button type="submit" variant="outline" size="sm">
              Set as Primary
            </Button>
          </form>
        )}
      </div>

      <CvEditor
        cvId={cv.id}
        cvName={cv.name ?? cvData.name ?? ""}
        initialData={cvData}
      />
    </div>
  )
}
