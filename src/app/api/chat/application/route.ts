import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { MissingAiApiKeyError, WEB_SEARCH_COST_MICROUSD, withPlatformAiKeyAccess } from "@/lib/ai"
import type { GeneratedText, UserPreferences } from "@/lib/ai"
import { runAiAction } from "@/lib/ai/action"
import { aiErrorResponse } from "@/lib/ai/http"
import { AiAllowanceExhaustedError } from "@/lib/billing/usage"
import type { AppWithJob, CvData } from "@/lib/supabase/database.types"
import { buildChatAssistantSystemPrompt } from "@/lib/ai/prompts"
import { chatRateLimit } from "@/lib/rate-limit"
import { formatConfirmedProfileEvidence } from "@/lib/candidate-evidence"

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

  // Fetch CV + AI settings in parallel.
  // applications.selected_cv_id = FK to user_cvs.id (user-selected base CV).
  // Tailored CV lives in customized_cvs keyed by application_id.
  const selectedCvId = typedApp.selected_cv_id
  const [
    { data: profile },
    { data: tailoredCvRow },
    { data: baseCvRow },
    { data: profileFacts },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("preferences, allow_platform_ai_key")
      .eq("id", user.id)
      .single(),
    // Latest AI-generated tailored CV for this application
    supabase
      .from("customized_cvs")
      .select("cv_json")
      .eq("application_id", applicationId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // User-selected base CV, or fall back to their primary CV
    selectedCvId
      ? supabase.from("user_cvs").select("parsed_json, name").eq("id", selectedCvId).eq("user_id", user.id).single()
      : supabase.from("user_cvs").select("parsed_json, name").eq("user_id", user.id).eq("is_primary", true).maybeSingle(),
    supabase
      .from("interview_profile_facts")
      .select("category, label, detail")
      .eq("user_id", user.id)
      .neq("confirmed_at", null),
  ])

  const prefs = withPlatformAiKeyAccess(
    (profile?.preferences ?? {}) as UserPreferences,
    profile?.allow_platform_ai_key === true,
  )

  // Build system prompt with full application context
  const job = typedApp.jobs_cache
  const salaryLine =
    typeof typedApp.custom_salary_text === "string"
      ? typedApp.custom_salary_text
        ? `Salary: ${typedApp.custom_salary_text}`
        : null
      : job?.salary_min != null
      ? `Salary: £${Number(job.salary_min).toLocaleString()}${
          job.salary_max != null ? ` – £${Number(job.salary_max).toLocaleString()}` : ""
        }`
      : null

  const systemPrompt = buildChatAssistantSystemPrompt({
    title: typedApp.custom_title ?? job?.title ?? "Unknown",
    company: typedApp.custom_company ?? job?.company ?? "Unknown",
    location: typedApp.custom_location ?? job?.location ?? null,
    salaryLine,
    status: typedApp.status,
    description: typedApp.custom_description ?? job?.description ?? "No description provided.",
    baseCv: (baseCvRow?.parsed_json ?? null) as CvData | null,
    baseCvName: baseCvRow?.name ?? null,
    tailoredCv: (tailoredCvRow?.cv_json ?? null) as CvData | null,
    confirmedEvidence: formatConfirmedProfileEvidence(profileFacts ?? []),
  })

  // The stream outlives this handler's return, so the action (reserve -> stream -> settle) runs in the background:
  // `responseReady` hands the Response out as soon as streaming starts, and the stream only closes once settlement is done.
  let respond!: (response: Response) => void
  const responseReady = new Promise<Response>((resolve) => { respond = resolve })
  const settled: Promise<unknown> = runAiAction(
    { userId: user.id, actionId: randomUUID(), feature: "application_chat", preferences: prefs },
    async (ai) => {
      let usage: GeneratedText
      let streamError: unknown
      let onDone!: () => void
      const done = new Promise<void>((resolve) => { onDone = resolve })
      let abort: () => void = () => {}
      let source: AsyncIterable<unknown>
      let finalUsage: () => Promise<GeneratedText>

      if (ai.settings.provider === "anthropic") {
        const { default: Anthropic } = await import("@anthropic-ai/sdk")
        const client = new Anthropic({ apiKey: ai.apiKey })
        const stream = client.messages.stream({
          model: ai.settings.model,
          max_tokens: 4096,
          system: systemPrompt,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: validatedMessages.map((m) => ({ role: m.role, content: m.content })),
        } as Parameters<typeof client.messages.stream>[0])
        abort = () => stream.controller.abort()
        source = stream
        finalUsage = async () => {
          const message = await stream.finalMessage()
          const searches = (message.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0
          return {
            text: "",
            providerRequestId: message.id,
            inputTokens: message.usage.input_tokens,
            cachedInputTokens: message.usage.cache_read_input_tokens ?? 0,
            outputTokens: message.usage.output_tokens,
            toolCostMicrousd: searches * WEB_SEARCH_COST_MICROUSD,
          }
        }
      } else {
        const { default: OpenAI } = await import("openai")
        const client = new OpenAI({ apiKey: ai.apiKey })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stream = await (client as any).responses.create({
          model: ai.settings.model,
          instructions: systemPrompt,
          tools: [{ type: "web_search" }],
          input: validatedMessages.map((m) => ({ role: m.role, content: m.content })),
          stream: true,
        })
        abort = () => stream.controller?.abort()
        let completed: Record<string, unknown> | null = null
        source = (async function* () {
          for await (const event of stream) {
            const record = asRecord(event)
            if (record?.type === "response.completed") completed = asRecord(record.response)
            yield event
          }
        })()
        finalUsage = async () => {
          const responseUsage = asRecord(completed?.usage)
          const output = Array.isArray(completed?.output) ? completed.output : []
          const searches = output.filter((item) => asRecord(item)?.type === "web_search_call").length
          return {
            text: "",
            providerRequestId: typeof completed?.id === "string" ? completed.id : undefined,
            inputTokens: Number(responseUsage?.input_tokens ?? 0),
            cachedInputTokens: Number(asRecord(responseUsage?.input_tokens_details)?.cached_tokens ?? 0),
            outputTokens: Number(responseUsage?.output_tokens ?? 0),
            toolCostMicrousd: searches * WEB_SEARCH_COST_MICROUSD,
          }
        }
      }

      const textOf = (event: unknown) => {
        const eventRecord = asRecord(event)
        const delta = asRecord(eventRecord?.delta)
        return eventRecord?.type === "content_block_delta" && delta?.type === "text_delta" && typeof delta.text === "string"
          ? delta.text
          : eventRecord?.type === "response.output_text.delta" && typeof eventRecord.delta === "string"
          ? eventRecord.delta
          : ""
      }

      // Wait for the first text before responding, so a provider failure (no credit, bad key or model) or an empty
      // reply becomes a real error the client can show, rather than a 200 with a blank body.
      const iterator = source[Symbol.asyncIterator]()
      let first = ""
      while (!first) {
        const next = await iterator.next()
        if (next.done) break
        first = textOf(next.value)
      }
      if (!first) {
        try { ai.record(await finalUsage()) } catch { /* nothing billable to record */ }
        throw new EmptyAiResponseError()
      }

      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(first))
            for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
              const text = textOf(next.value)
              if (text) controller.enqueue(encoder.encode(text))
            }
            usage = await finalUsage()
          } catch (error) {
            streamError = error
          } finally {
            onDone()
            // Hold the stream open until the reservation is settled (or released), so the work finishes before the response ends.
            await settled.catch(() => {})
            try {
              if (streamError) controller.error(streamError)
              else controller.close()
            } catch {
              // The client already cancelled the stream.
            }
          }
        },
        cancel() {
          abort()
        },
      })
      respond(new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } }))

      await done
      // ponytail: a stream that fails or is cancelled mid-way releases the reservation without its partial usage; meter partials if abuse shows up.
      if (streamError) throw streamError
      ai.record(usage!)
    },
  )
  const failure = await Promise.race([responseReady.then(() => null), settled.then(() => null, (error: unknown) => ({ error }))])
  if (!failure) return responseReady
  console.error("Chat error:", failure.error)
  if (failure.error instanceof MissingAiApiKeyError || failure.error instanceof AiAllowanceExhaustedError) {
    return aiErrorResponse(failure.error, "AI request failed")
  }
  const { message, status } = describeProviderFailure(failure.error)
  return NextResponse.json({ error: message }, { status })
}

class EmptyAiResponseError extends Error {
  constructor() {
    super("The AI returned an empty response")
  }
}

function describeProviderFailure(error: unknown): { message: string; status: number } {
  if (error instanceof EmptyAiResponseError) return { message: "The AI returned an empty response. Please try again.", status: 502 }
  const status = (error as { status?: unknown } | null)?.status
  const text = error instanceof Error ? error.message : ""
  if (/credit|quota|billing/i.test(text)) {
    return { message: "The AI provider account has no credit left. Add credit or use a different API key in Settings.", status: 502 }
  }
  if (status === 401 || status === 403) {
    return { message: "The AI provider rejected the API key. Check it in Settings.", status: 502 }
  }
  if (status === 429) return { message: "The AI provider is rate limiting requests. Try again shortly.", status: 429 }
  return { message: "AI request failed", status: 500 }
}
