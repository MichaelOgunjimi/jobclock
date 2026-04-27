import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { interviewPrep } from "@/lib/db/schema"
import { resolveAiConfig, generateText, type UserPreferences } from "@/lib/ai"
import { callPerplexity } from "@/lib/ai/perplexity"
import { decrypt } from "@/lib/crypto"
import { researchSystemPrompt, researchUserPrompt } from "@/lib/prompts/company-research"
import type { AppWithJob } from "@/lib/supabase/database.types"
import { aiGenerateRateLimit } from "@/lib/rate-limit"

// D3: 6-axis company research. Uses Perplexity (live web) if the user has
// configured a key; otherwise falls back to Claude/OpenAI training knowledge.
// Result is saved to interview_prep.research_content so navigating away is safe.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { success: withinLimit } = await aiGenerateRateLimit.limit(user.id)
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      { status: 429 }
    )
  }

  const [{ data: appData }, { data: profileData }] = await Promise.all([
    supabase.from("applications").select("*, jobs_cache (*)").eq("id", applicationId).eq("user_id", user.id).single(),
    supabase.from("profiles").select("preferences").eq("id", user.id).single(),
  ])

  if (!appData) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  const app = appData as unknown as AppWithJob
  const company = app.jobs_cache?.company ?? "this company"
  const title = app.jobs_cache?.title ?? "this role"
  const description = (app.custom_description ?? app.jobs_cache?.description ?? "").slice(0, 1500)

  const preferences = (profileData?.preferences ?? {}) as UserPreferences
  const systemPrompt = researchSystemPrompt()
  const userPrompt = researchUserPrompt({ company, title, description })

  let content: string
  try {
    const rawPerplexityKey = preferences.perplexity_api_key
    if (rawPerplexityKey) {
      const perplexityKey = decrypt(rawPerplexityKey)
      content = await callPerplexity(
        [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        { apiKey: perplexityKey, model: "sonar-pro", maxTokens: 3500 }
      )
    } else {
      let settings: ReturnType<typeof resolveAiConfig>["settings"]
      let apiKey: string
      try {
        const resolved = resolveAiConfig(preferences)
        settings = resolved.settings
        apiKey = resolved.apiKey
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "No AI API key configured." }, { status: 422 })
      }
      content = await generateText(settings, apiKey, systemPrompt, userPrompt, 3500)
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Company research failed" }, { status: 500 })
  }

  // Save to DB so navigating away doesn't lose it
  const existing = await db.select({ id: interviewPrep.id }).from(interviewPrep).where(eq(interviewPrep.applicationId, applicationId)).limit(1)
  if (existing.length > 0) {
    await db.update(interviewPrep).set({ researchContent: content }).where(eq(interviewPrep.applicationId, applicationId))
  } else {
    await db.insert(interviewPrep).values({ applicationId, researchContent: content })
  }

  return NextResponse.json({ content, company, title })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Verify the application belongs to this user before returning saved research
  const { data: appCheck } = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single()
  if (!appCheck) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [prep] = await db.select({ researchContent: interviewPrep.researchContent }).from(interviewPrep).where(eq(interviewPrep.applicationId, applicationId)).limit(1)
  return NextResponse.json({ content: prep?.researchContent ?? null })
}
