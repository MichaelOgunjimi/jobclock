import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAiSettings, resolveApiKey } from "@/lib/ai"
import type { UserPreferences } from "@/lib/ai"
import type { CvData, Database } from "@/lib/supabase/database.types"

type AppWithJob = Database["public"]["Tables"]["applications"]["Row"] & {
  jobs_cache: Database["public"]["Tables"]["jobs_cache"]["Row"] | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { messages, applicationId } = await request.json()
  if (!applicationId || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  // Fetch application + job context (ownership enforced via user_id)
  const { data: app } = await supabase
    .from("applications")
    .select("*, jobs_cache(*)")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single()
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const typedApp = app as unknown as AppWithJob

  // Fetch CV + AI settings in parallel
  const cvId = typedApp.customized_cv_id
  const [{ data: profile }, { data: cvRow }] = await Promise.all([
    supabase.from("profiles").select("preferences").eq("id", user.id).single(),
    cvId
      ? supabase.from("user_cvs").select("parsed_json, name").eq("id", cvId).eq("user_id", user.id).single()
      : Promise.resolve({ data: null }),
  ])

  const prefs = (profile?.preferences ?? {}) as UserPreferences

  let settings, apiKey: string
  try {
    settings = resolveAiSettings(prefs)
    apiKey = resolveApiKey(settings.provider, prefs)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No AI API key configured" },
      { status: 422 }
    )
  }

  // Build system prompt with full application context
  const job = typedApp.jobs_cache
  const salaryLine =
    job?.salary_min != null
      ? `Salary: £${Number(job.salary_min).toLocaleString()}${
          job.salary_max != null ? ` – £${Number(job.salary_max).toLocaleString()}` : ""
        }`
      : null

  const cv = cvRow?.parsed_json as CvData | null
  const cvLines: (string | null)[] = cv
    ? [
        "",
        `User's CV (${cvRow?.name ?? "uploaded CV"}):`,
        cv.name ? `Name: ${cv.name}` : null,
        cv.summary ? `Summary: ${cv.summary}` : null,
        cv.skills?.length ? `Skills: ${cv.skills.join(", ")}` : null,
        cv.experience?.length
          ? [
              "Experience:",
              ...cv.experience.map(
                (e) =>
                  `  - ${e.title} at ${e.company}${e.start_date ? ` (${e.start_date}–${e.end_date ?? "present"})` : ""}: ${e.description}`
              ),
            ].join("\n")
          : null,
        cv.education?.length
          ? [
              "Education:",
              ...cv.education.map(
                (e) => `  - ${e.degree}${e.field ? ` in ${e.field}` : ""} at ${e.institution}${e.end_date ? ` (${e.end_date})` : ""}${e.grade ? `, ${e.grade}` : ""}`
              ),
            ].join("\n")
          : null,
        cv.certifications?.length ? `Certifications: ${cv.certifications.join(", ")}` : null,
      ]
    : ["", "No CV selected for this application yet."]

  const systemPrompt = [
    "You are a job application assistant. The user is working on the following application:",
    "",
    `Role: ${job?.title ?? "Unknown"}`,
    `Company: ${job?.company ?? "Unknown"}`,
    job?.location ? `Location: ${job.location}` : null,
    salaryLine,
    `Application status: ${typedApp.status}`,
    "",
    "Job description:",
    job?.description ?? "No description provided.",
    ...cvLines,
    "",
    "Help the user with their application. You can:",
    "- Search the web and explain what the company does, their culture, and recent news",
    "- Suggest how to tailor a CV or cover letter for this specific role using their actual CV content",
    "- Help draft answers to application questions",
    "- Give tips for interviews and assessments at this company",
    "- Identify gaps between the user's CV and the job description",
    "",
    "Search the web proactively when asked about the company or role — don't rely only on training data.",
    "Be concise, specific, and practical.",
  ]
    .filter((l) => l !== null)
    .join("\n")

  try {
    if (settings.provider === "anthropic") {
      const { default: Anthropic } = await import("@anthropic-ai/sdk")
      const client = new Anthropic({ apiKey })

      const stream = client.messages.stream({
        model: settings.model,
        max_tokens: 1024,
        system: systemPrompt,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      } as Parameters<typeof client.messages.stream>[0])

      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of stream) {
              const eventRecord = asRecord(event)
              const delta = asRecord(eventRecord?.delta)

              if (
                eventRecord?.type === "content_block_delta" &&
                delta?.type === "text_delta" &&
                typeof delta.text === "string"
              ) {
                controller.enqueue(new TextEncoder().encode(delta.text))
              }
            }
          } finally {
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    } else {
      const { default: OpenAI } = await import("openai")
      const client = new OpenAI({ apiKey })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = await (client as any).responses.create({
        model: settings.model,
        instructions: systemPrompt,
        tools: [{ type: "web_search" }],
        input: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      })

      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of stream) {
              const eventRecord = asRecord(event)
              if (eventRecord?.type === "response.output_text.delta") {
                const delta =
                  typeof eventRecord.delta === "string" ? eventRecord.delta : ""
                if (delta) controller.enqueue(new TextEncoder().encode(delta))
              }
            }
          } finally {
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    }
  } catch (err) {
    console.error("Chat error:", err)
    return NextResponse.json({ error: "AI request failed" }, { status: 500 })
  }
}
