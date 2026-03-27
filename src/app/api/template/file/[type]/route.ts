import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const { type } = await params
  if (type !== "cv" && type !== "cover_letter") {
    return new NextResponse("Invalid type", { status: 400 })
  }

  const column = type === "cv" ? "cv_template_path" : "cover_letter_template_path"

  const { data: profile } = await supabase
    .from("profiles")
    .select(column)
    .eq("id", user.id)
    .single()

  const path = (profile as Record<string, unknown>)?.[column] as string | null
  if (!path) return new NextResponse("Not found", { status: 404 })

  const { data, error } = await supabase.storage.from("templates").download(path)
  if (error) return new NextResponse("Failed to fetch template", { status: 500 })

  const buffer = await data.arrayBuffer()
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  })
}
