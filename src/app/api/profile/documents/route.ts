import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import mammoth from "mammoth"
import pdfParse from "pdf-parse"
import { NextResponse } from "next/server"
import { extractProfileDocument } from "@/lib/ai/profile-document"
import {
  MissingAiApiKeyError,
  withPlatformAiKeyAccess,
  type UserPreferences,
} from "@/lib/ai"
import { db } from "@/lib/db"
import {
  interviewProfileFacts,
  profileDocuments,
  profiles,
} from "@/lib/db/schema"
import {
  PROFILE_DOCUMENT_ACCEPTED_TYPES,
  PROFILE_DOCUMENT_MAX_BYTES,
  matchesProfileDocumentSignature,
  profileDocumentTypeSchema,
} from "@/lib/profile-documents"
import { cvGenerateRateLimit } from "@/lib/rate-limit"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 180

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    typeof value.name === "string" &&
    typeof value.type === "string" &&
    typeof value.size === "number"
  )
}

async function readableText(buffer: Buffer, mimeType: string): Promise<string | undefined> {
  if (mimeType === "application/pdf") {
    try {
      const text = (await pdfParse(buffer)).text.trim()
      return text.length >= 50 ? text : undefined
    } catch {
      return undefined
    }
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const text = (await mammoth.extractRawText({ buffer })).value.trim()
    if (text.length < 50) {
      throw new Error("Could not extract enough readable text from this Word document.")
    }
    return text
  }

  return undefined
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { success: withinLimit } = await cvGenerateRateLimit.limit(user.id)
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many document uploads. Please wait a moment before trying again." },
      { status: 429 },
    )
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: "A multipart form is required." }, { status: 400 })
  }
  const file = formData.get("file")
  const parsedType = profileDocumentTypeSchema.safeParse(formData.get("type"))
  if (!isUploadedFile(file) || !parsedType.success) {
    return NextResponse.json({ error: "A file and valid document type are required." }, { status: 400 })
  }
  if (file.size === 0 || file.size > PROFILE_DOCUMENT_MAX_BYTES) {
    return NextResponse.json({ error: "Document must be between 1 byte and 15 MB." }, { status: 400 })
  }
  if (!(PROFILE_DOCUMENT_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: "Upload a PDF, DOCX, JPEG, PNG, or WebP document." },
      { status: 400 },
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    if (!matchesProfileDocumentSignature(buffer, file.type)) {
      return NextResponse.json(
        { error: "The file contents do not match the selected file type." },
        { status: 400 },
      )
    }
    const rawText = await readableText(buffer, file.type)
    const profileRows = await db
      .select({
        preferences: profiles.preferences,
        allowPlatformAiKey: profiles.allowPlatformAiKey,
      })
      .from(profiles)
      .where(eq(profiles.id, user.id))
    const profile = profileRows[0]
    const extracted = await extractProfileDocument({
      buffer,
      mimeType: file.type,
      filename: file.name,
      type: parsedType.data,
      rawText,
      preferences: withPlatformAiKeyAccess(
        (profile?.preferences ?? null) as UserPreferences | null,
        profile?.allowPlatformAiKey,
      ),
    })

    const documentId = randomUUID()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "document"
    const storagePath = `${user.id}/${documentId}/${safeName}`
    const { error: uploadError } = await supabase.storage
      .from("profile-documents")
      .upload(storagePath, buffer, { contentType: file.type, upsert: false })
    if (uploadError) throw new Error("Failed to store the document.")

    try {
      const result = await db.transaction(async (tx) => {
        const [document] = await tx
          .insert(profileDocuments)
          .values({
            id: documentId,
            userId: user.id,
            type: parsedType.data,
            name: extracted.name,
            issuer: extracted.issuer,
            issuedAt: extracted.issuedAt,
            expiresAt: extracted.expiresAt,
            credentialId: extracted.credentialId,
            credentialUrl: extracted.credentialUrl,
            originalFilePath: storagePath,
            mimeType: file.type,
            fileSize: file.size,
          })
          .returning()
        const facts = await tx
          .insert(interviewProfileFacts)
          .values(
            extracted.facts.map((fact, index) => ({
              userId: user.id,
              ...fact,
              sourceType: "document",
              sourceRef: `document:${documentId}:${index}`,
              sourceDocumentId: documentId,
            })),
          )
          .returning()
        return { document, facts }
      })
      return NextResponse.json(result, { status: 201 })
    } catch (error) {
      await supabase.storage.from("profile-documents").remove([storagePath])
      throw error
    }
  } catch (error) {
    console.error("Profile document upload error:", error)
    return NextResponse.json(
      {
        error: error instanceof MissingAiApiKeyError
          ? error.message
          : "Failed to process the document.",
      },
      { status: 422 },
    )
  }
}
