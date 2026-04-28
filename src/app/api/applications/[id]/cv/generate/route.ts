import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAiConfig, generateText } from "@/lib/ai"
import { extractJson } from "@/lib/ai/extract-json"
import { cvGenerateRateLimit } from "@/lib/rate-limit"
import { normalizeObjectStrings } from "@/lib/cv/normalize"
import type { UserPreferences } from "@/lib/ai"
import type { AppWithJob, Json } from "@/lib/supabase/database.types"
import {
  STAGE_B_SYSTEM_PROMPT,
  buildStageBUserPrompt,
  STAGE_C_SYSTEM_PROMPT,
  buildStageCUserPrompt,
  STAGE_D_SYSTEM_PROMPT,
  buildStageDUserPrompt,
  STAGE_E_SYSTEM_PROMPT,
  buildStageEUserPrompt,
} from "@/lib/ai/prompts"
import {
  jobAnalysisSchema,
  cvMatchAnalysisSchema,
  cvTailoringPlanSchema,
  tailoredCvResultSchema,
} from "@/lib/ai/cv-tailoring-schemas"
import type {
  JobAnalysis,
  CvMatchAnalysis,
  CvTailoringPlan,
  TailoredCvResult,
  StoredSkillsGap,
  GenerationProgressEvent,
} from "@/lib/ai/cv-tailoring-types"

function sse(event: GenerationProgressEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { success: withinLimit } = await cvGenerateRateLimit.limit(user.id)
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Rate limit reached. Please wait a moment before generating another CV." },
      { status: 429 }
    )
  }

  // Fetch application + profile in parallel
  const [{ data: appData }, { data: profileData }] = await Promise.all([
    supabase
      .from("applications")
      .select("*, jobs_cache (*)")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single(),
    supabase.from("profiles").select("preferences").eq("id", user.id).single(),
  ])

  if (!appData) return NextResponse.json({ error: "Application not found" }, { status: 404 })
  const app = appData as unknown as AppWithJob

  const description = app.custom_description ?? app.jobs_cache?.description
  if (!description?.trim()) {
    return NextResponse.json({ error: "No job description found. Add one first." }, { status: 422 })
  }

  // Resolve base CV
  let baseCvId: string | null = app.selected_cv_id ?? null
  if (!baseCvId) {
    const { data: primaryCv } = await supabase
      .from("user_cvs")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_primary", true)
      .maybeSingle()
    baseCvId = primaryCv?.id ?? null
  }
  if (!baseCvId) {
    return NextResponse.json({ error: "No CV found. Upload a CV first." }, { status: 422 })
  }

  const { data: cvRow } = await supabase
    .from("user_cvs")
    .select("parsed_json")
    .eq("id", baseCvId)
    .eq("user_id", user.id)
    .single()

  if (!cvRow?.parsed_json) {
    return NextResponse.json({ error: "CV has no parsed content. Re-upload your CV." }, { status: 422 })
  }

  // Resolve AI config
  const preferences = (profileData?.preferences ?? {}) as UserPreferences
  let settings: ReturnType<typeof resolveAiConfig>["settings"]
  let apiKey: string
  try {
    const resolved = resolveAiConfig(preferences)
    settings = resolved.settings
    apiKey = resolved.apiKey
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No API key configured." },
      { status: 422 }
    )
  }

  const job = app.jobs_cache
  const title = job?.title ?? "the role"
  const company = job?.company ?? "the company"
  const location = job?.location ?? null
  const cvJson = JSON.stringify(cvRow.parsed_json, null, 2)

  const readable = new ReadableStream({
    async start(controller) {
      function emit(event: GenerationProgressEvent) {
        controller.enqueue(new TextEncoder().encode(sse(event)))
      }

      try {
        // ── Stage B: JD Analysis ──────────────────────────────────────────────
        emit({ stage: "B", status: "running" })
        let jobAnalysis: JobAnalysis
        try {
          const raw = await generateText(
            settings,
            apiKey,
            STAGE_B_SYSTEM_PROMPT,
            buildStageBUserPrompt({ title, company, location, description })
          )
          const extracted = extractJson(raw)
          const parsed = jobAnalysisSchema.safeParse(extracted)
          if (!parsed.success) {
            const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
            console.error("[CV Generate] Stage B validation failed:", issues, "\nExtracted:", JSON.stringify(extracted).slice(0, 500))
            emit({ stage: "B", status: "error", error: `Stage B validation failed: ${issues}` })
            controller.close()
            return
          }
          jobAnalysis = parsed.data
        } catch (err) {
          emit({ stage: "B", status: "error", error: err instanceof Error ? err.message : "Stage B failed" })
          controller.close()
          return
        }
        emit({ stage: "B", status: "done" })

        // ── Stage C: CV Match ─────────────────────────────────────────────────
        emit({ stage: "C", status: "running" })
        let matchAnalysis: CvMatchAnalysis
        try {
          const raw = await generateText(
            settings,
            apiKey,
            STAGE_C_SYSTEM_PROMPT,
            buildStageCUserPrompt({ jobAnalysis, cvJson })
          )
          const extractedC = extractJson(raw)
          const parsed = cvMatchAnalysisSchema.safeParse(extractedC)
          if (!parsed.success) {
            const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
            console.error("[CV Generate] Stage C validation failed:", issues, "\nExtracted:", JSON.stringify(extractedC).slice(0, 500))
            emit({ stage: "C", status: "error", error: `Stage C validation failed: ${issues}` })
            controller.close()
            return
          }
          matchAnalysis = parsed.data
        } catch (err) {
          emit({ stage: "C", status: "error", error: err instanceof Error ? err.message : "Stage C failed" })
          controller.close()
          return
        }
        emit({ stage: "C", status: "done" })

        // ── Stage D: Tailoring Plan ───────────────────────────────────────────
        emit({ stage: "D", status: "running" })
        let tailoringPlan: CvTailoringPlan
        try {
          const raw = await generateText(
            settings,
            apiKey,
            STAGE_D_SYSTEM_PROMPT,
            buildStageDUserPrompt({ jobAnalysis, matchAnalysis, cvJson })
          )
          const extractedD = extractJson(raw)
          const parsed = cvTailoringPlanSchema.safeParse(extractedD)
          if (!parsed.success) {
            const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
            console.error("[CV Generate] Stage D validation failed:", issues, "\nExtracted:", JSON.stringify(extractedD).slice(0, 500))
            emit({ stage: "D", status: "error", error: `Stage D validation failed: ${issues}` })
            controller.close()
            return
          }
          tailoringPlan = parsed.data
        } catch (err) {
          emit({ stage: "D", status: "error", error: err instanceof Error ? err.message : "Stage D failed" })
          controller.close()
          return
        }
        emit({ stage: "D", status: "done" })

        // ── Stage E: Tailor Writer ────────────────────────────────────────────
        emit({ stage: "E", status: "running" })
        let result: TailoredCvResult
        try {
          const raw = await generateText(
            settings,
            apiKey,
            STAGE_E_SYSTEM_PROMPT,
            buildStageEUserPrompt({ jobAnalysis, cvJson, tailoringPlan, title, company, location }),
            16384
          )
          const extractedE = extractJson(raw)
          const parsed = tailoredCvResultSchema.safeParse(extractedE)
          if (!parsed.success) {
            const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
            console.error("[CV Generate] Stage E validation failed:", issues, "\nRaw length:", raw.length, "\nExtracted keys:", typeof extractedE === "object" && extractedE ? Object.keys(extractedE) : typeof extractedE)
            emit({ stage: "E", status: "error", error: `Stage E validation failed: ${issues}` })
            controller.close()
            return
          }
          result = parsed.data
        } catch (err) {
          emit({ stage: "E", status: "error", error: err instanceof Error ? err.message : "Stage E failed" })
          controller.close()
          return
        }

        if (!result.cv) {
          emit({ stage: "E", status: "error", error: "AI returned incomplete CV data. Please try again." })
          controller.close()
          return
        }

        // ── DB insert ─────────────────────────────────────────────────────────
        const skillsGap: StoredSkillsGap = {
          gap: result.missing_keywords,
          changes: result.match_summary,
          matched_keywords: result.matched_keywords,
          missing_keywords: result.missing_keywords,
          match_summary: result.match_summary,
          ats_basis: result.ats_match_estimate?.basis,
        }

        const { error: insertError } = await supabase.from("customized_cvs").insert({
          user_id: user.id,
          application_id: applicationId,
          cv_json: normalizeObjectStrings(result.cv) as unknown as Json,
          ats_score: result.ats_match_estimate?.score ?? null,
          skills_gap: skillsGap as unknown as Json,
        })

        if (insertError) {
          emit({ stage: "E", status: "error", error: insertError.message })
          controller.close()
          return
        }

        emit({ stage: "E", status: "done" })
        emit({ done: true })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8" },
  })
}
