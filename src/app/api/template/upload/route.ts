import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const type = formData.get("type") as "cv" | "cover_letter" | null

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
  if (type !== "cv" && type !== "cover_letter") return NextResponse.json({ error: "Invalid type" }, { status: 400 })

  const ext = file.name.split(".").pop()?.toLowerCase()
  if (ext !== "docx" && ext !== "doc") {
    return NextResponse.json({ error: "Please upload a DOCX file" }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const storagePath = `${user.id}/${type}-template.docx`

  const { error: uploadError } = await supabase.storage
    .from("templates")
    .upload(storagePath, buffer, {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  return NextResponse.json({ path: storagePath })
}
