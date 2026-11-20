import { randomUUID } from "node:crypto"
import { createClient } from "@/lib/supabase/server"
import { aiGenerateRateLimit } from "@/lib/rate-limit"
import { withPlatformAiKeyAccess, type UserPreferences } from "@/lib/ai"
import { runAiAction } from "@/lib/ai/action"
import { aiErrorResponse } from "@/lib/ai/http"
import { reviewCv } from "@/lib/ai/cv-review"
import { normalizeCvData } from "@/lib/cv-data"
import type { CvData, Json } from "@/lib/supabase/database.types"

export const maxDuration = 120

/** Re-review the saved CV (never client-sent content) and replace its stored findings. One metered AI call. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { success: withinLimit } = await aiGenerateRateLimit.limit(user.id)
  if (!withinLimit) {
    return Response.json({ error: "Too many requests. Please wait a moment before trying again." }, { status: 429 })
  }

  const { data: cv } = await supabase
    .from("user_cvs")
    .select("parsed_json")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (!cv) return Response.json({ error: "CV not found" }, { status: 404 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferences, allow_platform_ai_key")
    .eq("id", user.id)
    .single()
  const preferences = withPlatformAiKeyAccess(
    (profile?.preferences ?? {}) as UserPreferences,
    profile?.allow_platform_ai_key === true,
  )

  const cvData = normalizeCvData(cv.parsed_json as CvData | null)
  try {
    const findings = await runAiAction(
      { userId: user.id, actionId: randomUUID(), feature: "cv_review", preferences },
      (ai) => reviewCv(cvData, ai),
    )
    const { error } = await supabase
      .from("user_cvs")
      .update({ review_findings: findings as unknown as Json })
      .eq("id", id)
      .eq("user_id", user.id)
    // The review is already paid for, so hand it back even if it could not be stored.
    if (error) console.error("CV review findings save error:", error)
    return Response.json({ findings })
  } catch (error) {
    return aiErrorResponse(error, "CV review failed", 502)
  }
}
