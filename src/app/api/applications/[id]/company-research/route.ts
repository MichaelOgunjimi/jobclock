import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { callPerplexity } from "@/lib/ai/perplexity"
import type { AppWithJob } from "@/lib/supabase/database.types"

// D3: 6-axis company research using Perplexity sonar-pro (web search grounded).
// Ported from Career-Ops modes/deep.md research framework.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: appData } = await supabase
    .from("applications")
    .select("*, jobs_cache (*)")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single()

  if (!appData) return NextResponse.json({ error: "Application not found" }, { status: 404 })

  const app = appData as unknown as AppWithJob
  const company = app.jobs_cache?.company ?? "this company"
  const title = app.jobs_cache?.title ?? "this role"
  const description = (app.custom_description ?? app.jobs_cache?.description ?? "").slice(0, 1500)

  const prompt = `Research ${company} for a candidate interviewing for the ${title} role. Use your web search to find current, accurate information.

Provide a structured research report across these 6 axes:

1. AI/PRODUCT STRATEGY
   - What products or services they offer
   - Their tech stack (if known from engineering blogs, job postings, or GitHub)
   - Any recent AI initiatives, model usage, or LLM integrations
   - Key engineering blog posts or papers from the last 12 months

2. RECENT MOVES (last 6–12 months)
   - Funding rounds, M&A activity, or pivots
   - Key executive hires or departures
   - Major product launches or announcements
   - Headcount changes (growing fast? layoffs?)

3. ENGINEERING CULTURE
   - Remote vs hybrid vs on-site policy
   - Shipping cadence (fast-moving startup vs enterprise pace)
   - Known engineering practices (mono-repo, open source contributions, etc.)
   - What engineers say about working there (Glassdoor, Blind, X/Twitter)

4. PROBABLE CHALLENGES
   - What business or technical problems this team is likely solving right now
   - Scaling challenges, cost pressures, competitive threats
   - Why they're hiring for this role specifically

5. COMPETITIVE LANDSCAPE
   - Main competitors
   - What differentiates ${company} from them
   - Their market position and trajectory

6. ROLE-SPECIFIC ANGLE
   Based on this job description excerpt:
   "${description}"

   What specific experience or knowledge would make a candidate stand out?
   What questions might they ask that would impress the interviewer?

Format each section clearly. Cite your sources inline. If information is uncertain, say so explicitly.`

  try {
    const content = await callPerplexity(
      [
        {
          role: "system",
          content: "You are a professional company researcher. Use your web search capability to find accurate, current information. Always cite sources. Do not fabricate facts.",
        },
        { role: "user", content: prompt },
      ],
      { model: "sonar-pro", maxTokens: 3500 }
    )

    return NextResponse.json({ content, company, title })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Company research failed" },
      { status: 500 }
    )
  }
}
