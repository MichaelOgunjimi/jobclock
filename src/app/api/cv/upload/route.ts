import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import pdfParse from "pdf-parse"
import mammoth from "mammoth"
import { parseCvWithAi } from "@/lib/ai/parse-cv"
import type { UserPreferences } from "@/lib/ai"
import type { Json } from "@/lib/supabase/database.types"

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 503 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const cvName = (formData.get("name") as string | null)?.trim() || null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 10MB." }, { status: 400 })
    }

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a PDF or DOCX file." },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let rawText = ""

    if (file.type === "application/pdf") {
      try {
        const result = await pdfParse(buffer)
        rawText = result.text
      } catch (parseError) {
        console.error("PDF parse error:", parseError)
        return NextResponse.json(
          { error: "Failed to parse PDF. Please ensure it's a valid PDF file." },
          { status: 422 }
        )
      }
    } else {
      try {
        const result = await mammoth.extractRawText({ buffer })
        rawText = result.value
      } catch (parseError) {
        console.error("DOCX parse error:", parseError)
        return NextResponse.json(
          { error: "Failed to parse DOCX. Please ensure it's a valid Word document." },
          { status: 422 }
        )
      }
    }

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract enough text from the file. Please ensure your CV has readable content." },
        { status: 422 }
      )
    }

    // Fetch user's AI settings for parsing
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", user.id)
      .single()

    const preferences = profile?.preferences as UserPreferences | null

    // AI-powered CV parsing
    let parsedCv
    try {
      parsedCv = await parseCvWithAi(rawText, preferences)
    } catch (aiError) {
      console.error("AI parse error:", aiError)
      return NextResponse.json(
        { error: "Failed to extract CV data. Please check your AI provider settings." },
        { status: 422 }
      )
    }

    // Upload original file to Supabase Storage
    const fileName = `${user.id}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from("cvs")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      return NextResponse.json(
        { error: "Failed to upload file. Please try again." },
        { status: 500 }
      )
    }

    const { data: { publicUrl } } = supabase.storage
      .from("cvs")
      .getPublicUrl(fileName)

    // First CV for this user becomes primary automatically
    const { count } = await supabase
      .from("user_cvs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)

    const isPrimary = (count ?? 0) === 0

    const { data: cvRecord, error: dbError } = await supabase
      .from("user_cvs")
      .insert({
        user_id: user.id,
        name: cvName ?? parsedCv.name ?? file.name.replace(/\.[^.]+$/, ""),
        original_file_path: fileName,
        parsed_json: parsedCv as unknown as Json,
        file_path: publicUrl,
        is_primary: isPrimary,
      })
      .select()
      .single()

    if (dbError) {
      console.error("Database insert error:", dbError)
      await supabase.storage.from("cvs").remove([fileName])
      return NextResponse.json(
        { error: "Failed to save CV record." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      cvId: cvRecord.id,
      parsed: parsedCv,
      fileUrl: publicUrl,
    })
  } catch (error) {
    console.error("CV upload error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    )
  }
}
