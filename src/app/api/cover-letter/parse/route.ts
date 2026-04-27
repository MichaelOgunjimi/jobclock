import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import pdfParse from "pdf-parse"
import mammoth from "mammoth"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum size is 10MB." }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type. Use PDF or DOCX." }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split(".").pop()?.toLowerCase()

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
