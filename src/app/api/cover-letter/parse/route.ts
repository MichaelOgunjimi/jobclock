import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import pdfParse from "pdf-parse"
import mammoth from "mammoth"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const ext = file.name.split(".").pop()?.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    let text = ""

    if (ext === "pdf") {
      const result = await pdfParse(buffer)
      text = result.text
    } else if (ext === "docx" || ext === "doc") {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
    } else {
      return NextResponse.json({ error: "Unsupported file type. Use PDF or DOCX." }, { status: 400 })
    }

    return NextResponse.json({ content: text.trim() })
  } catch {
    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 })
  }
}
