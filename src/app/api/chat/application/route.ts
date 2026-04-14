import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveAiConfig } from "@/lib/ai"
import type { AiSettings, UserPreferences } from "@/lib/ai"
import type { AppWithJob, CvData } from "@/lib/supabase/database.types"
import { buildChatAssistantSystemPrompt } from "@/lib/ai/prompts"
import { chatRateLimit } from "@/lib/rate-limit"

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

  // Rate limit: 20 requests per minute per user
  const { success: withinLimit } = await chatRateLimit.limit(user.id)
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before sending another message." },
      { status: 429 }
    )
  }

  const { messages: rawMessages, applicationId } = await request.json()
  if (!applicationId || !Array.isArray(rawMessages)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  // Cap history to last 20 messages to prevent unbounded context growth
  const messages = rawMessages.slice(-20)
  const VALID_ROLES = new Set(["user", "assistant"])
  const MAX_MESSAGE_LENGTH = 10_000
  const validatedMessages = messages
    .filter((m: unknown): m is { role: "user" | "assistant"; content: string } => {
      if (typeof m !== "object" || m === null) return false
      const candidate = m as Record<string, unknown>
      return (
        typeof candidate.role === "string" &&
        VALID_ROLES.has(candidate.role) &&
        typeof candidate.content === "string"
      )
    })
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_LENGTH),
    }))

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

  let settings: AiSettings
  let apiKey: string
  try {
    const resolved = resolveAiConfig(prefs)
    settings = resolved.settings
    apiKey = resolved.apiKey
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

  const systemPrompt = buildChatAssistantSystemPrompt({
    title: job?.title ?? "Unknown",
    company: job?.company ?? "Unknown",
    location: job?.location ?? null,
    salaryLine,
    status: typedApp.status,
    description: job?.description ?? "No description provided.",
    cv,
    cvName: cvRow?.name ?? null,
  })

  try {
    if (settings.provider === "anthropic") {
      const { default: Anthropic } = await import("@anthropic-ai/sdk")
      const client = new Anthropic({ apiKey })

      const stream = client.messages.stream({
        model: settings.model,
        max_tokens: 1024,
        system: systemPrompt,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: validatedMessages.map((m) => ({
          role: m.role,
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
        input: validatedMessages.map((m) => ({
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
