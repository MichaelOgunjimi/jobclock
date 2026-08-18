import { createClient } from "@/lib/supabase/server"
import { loadApplicationExport } from "@/lib/applications/export"
import { buildJsonAttachmentContentDisposition } from "@/lib/document-filename"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  try {
    const applicationExport = await loadApplicationExport(user.id, id)
    if (!applicationExport) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }

    const role = applicationExport.summary.role ?? "Unknown role"
    const company = applicationExport.summary.company ?? "Unknown company"

    return new Response(JSON.stringify(applicationExport, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": buildJsonAttachmentContentDisposition(
          `${company} - ${role} - Application Export`,
        ),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Failed to export application", error)
    return Response.json({ error: "Failed to export application" }, { status: 500 })
  }
}
