import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAiConfig, generateText, type UserPreferences } from "@/lib/ai"
import { callPerplexity } from "@/lib/ai/perplexity"
import { decrypt } from "@/lib/crypto"
import type { AppWithJob } from "@/lib/supabase/database.types"

// D3: 6-axis company research. Uses Perplexity (live web search) if the user
// has configured a Perplexity API key in Settings; otherwise falls back to the
// user's configured Claude/OpenAI model using training knowledge.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

  const systemPrompt = `You are a professional company researcher and career strategist. Provide accurate, structured company intelligence. Be specific. If you are uncertain about a fact, say so explicitly rather than guessing.`

  const userPrompt = `Research ${company} for a candidate interviewing for the ${title} role.

Provide a structured report across exactly these 6 axes:

1. AI/PRODUCT STRATEGY
   - Core products and services
   - Known tech stack and engineering approach
   - AI initiatives, LLM integrations, or ML product lines
   - Notable engineering blog posts, papers, or open-source work

2. RECENT MOVES (last 12 months)
   - Funding rounds, M&A activity, major pivots
   - Key leadership changes
   - Major product launches or announcements
   - Headcount trajectory (growing? restructuring?)

3. ENGINEERING CULTURE
   - Remote vs hybrid vs on-site policy
   - Known engineering practices (mono-repo, open source, etc.)
   - What engineers and employees say about working there
   - Shipping cadence and team structure

4. PROBABLE CHALLENGES
   - What business or technical problems this team is likely solving right now
   - Scaling, cost, or competitive pressures they face
   - Why they are likely hiring for this specific role

5. COMPETITIVE LANDSCAPE
   - Main competitors and how ${company} differentiates
   - Market position and trajectory
   - Any threats or tailwinds

6. YOUR PERSONAL ANGLE
   Based on this job description:
   "${description}"

   What specific experience or perspective would make a candidate stand out?
   What 2–3 insightful questions could the candidate ask that would impress the interviewer?
   What company-specific context should the candidate reference in answers?

Be honest about the limits of your knowledge. Use "likely" or "as of my last update" where appropriate.`

  // Prefer Perplexity (live web search) if the user has a key configured
  const rawPerplexityKey = preferences.perplexity_api_key
  if (rawPerplexityKey) {
    try {
      const perplexityKey = decrypt(rawPerplexityKey)
      const content = await callPerplexity(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { apiKey: perplexityKey, model: "sonar-pro", maxTokens: 3500 }
      )
      return NextResponse.json({ content, company, title, source: "perplexity" })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Perplexity research failed" }, { status: 500 })
    }
  }

  // Fallback: user's configured Claude or OpenAI
  let settings: ReturnType<typeof resolveAiConfig>["settings"]
  let apiKey: string
  try {
    const resolved = resolveAiConfig(preferences)
    settings = resolved.settings
    apiKey = resolved.apiKey
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No AI API key configured." }, { status: 422 })
  }

  try {
    const content = await generateText(settings, apiKey, systemPrompt, userPrompt, 3500)
    return NextResponse.json({ content, company, title, source: settings.provider })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Company research failed" }, { status: 500 })
  }
}
