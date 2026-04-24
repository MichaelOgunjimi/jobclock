import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 }
    )
  }

  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: cv } = await supabase
    .from("user_cvs")
    .select("original_file_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (!cv?.original_file_path) {
    return NextResponse.json({ error: "CV not found" }, { status: 404 })
  }

  const { data, error } = await supabase.storage
    .from("cvs")
    .createSignedUrl(cv.original_file_path, 60)

  if (error || !data?.signedUrl) {
    console.error("CV signed URL error:", error)
    return NextResponse.json(
      { error: "Failed to open CV" },
      { status: 500 }
    )
  }

  return NextResponse.redirect(data.signedUrl)
}
