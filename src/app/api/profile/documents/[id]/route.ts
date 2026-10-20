import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { z } from "zod/v4"
import { db } from "@/lib/db"
import { interviewProfileFacts, profileDocuments } from "@/lib/db/schema"
import {
  profileDocumentFactSchema,
  profileDocumentTypeSchema,
  isoDateSchema,
} from "@/lib/profile-documents"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"

const updateSchema = z.object({
  type: profileDocumentTypeSchema,
  name: z.string().trim().min(1).max(200),
  issuer: z.string().trim().max(500).nullable(),
  issuedAt: isoDateSchema.nullable(),
  expiresAt: isoDateSchema.nullable(),
  credentialId: z.string().trim().max(500).nullable(),
  credentialUrl: z.string().trim().url().refine((value) => /^https?:\/\//i.test(value)).nullable(),
  facts: z.array(profileDocumentFactSchema).min(1).max(50),
})

async function authenticatedDocument(id: string) {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured", status: 503 } as const
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized", status: 401 } as const
  const rows = await db
    .select()
    .from(profileDocuments)
    .where(and(eq(profileDocuments.id, id), eq(profileDocuments.userId, user.id)))
  const document = rows[0]
  if (!document) return { error: "Document not found", status: 404 } as const
  return { supabase, user, document } as const
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await authenticatedDocument(id)
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { data, error } = await auth.supabase.storage
    .from("profile-documents")
    .createSignedUrl(auth.document.originalFilePath, 60)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Failed to open document" }, { status: 500 })
  }
  return NextResponse.redirect(data.signedUrl)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await authenticatedDocument(id)
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Review data is invalid." }, { status: 400 })
  }

  const updated = await db.transaction(async (tx) => {
    await tx
      .update(profileDocuments)
      .set({
        type: parsed.data.type,
        name: parsed.data.name,
        issuer: parsed.data.issuer,
        issuedAt: parsed.data.issuedAt,
        expiresAt: parsed.data.expiresAt,
        credentialId: parsed.data.credentialId,
        credentialUrl: parsed.data.credentialUrl,
        updatedAt: new Date(),
      })
      .where(and(eq(profileDocuments.id, id), eq(profileDocuments.userId, auth.user.id)))
    await tx
      .delete(interviewProfileFacts)
      .where(
        and(
          eq(interviewProfileFacts.sourceDocumentId, id),
          eq(interviewProfileFacts.userId, auth.user.id),
        ),
      )
    return tx
      .insert(interviewProfileFacts)
      .values(
        parsed.data.facts.map((fact, index) => ({
          userId: auth.user.id,
          ...fact,
          sourceType: "document",
          sourceRef: `document:${id}:${index}`,
          sourceDocumentId: id,
          confirmedAt: new Date(),
        })),
      )
      .returning()
  })

  return NextResponse.json({ facts: updated })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await authenticatedDocument(id)
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  await db
    .delete(profileDocuments)
    .where(and(eq(profileDocuments.id, id), eq(profileDocuments.userId, auth.user.id)))
  const { error } = await auth.supabase.storage
    .from("profile-documents")
    .remove([auth.document.originalFilePath])
  if (error) console.error("Profile document storage cleanup error:", error)
  return new Response(null, { status: 204 })
}
