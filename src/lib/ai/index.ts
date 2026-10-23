import { decrypt } from "@/lib/crypto"

export type AiProvider = "anthropic" | "openai"

export const PROVIDER_MODELS: Record<AiProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (Recommended)" },
    { id: "claude-opus-5-5", label: "Claude Opus 5.5 (Advanced)" },
    { id: "claude-fable-5-1", label: "Claude Fable 5.1 (Deep Reasoning)" },
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (Fastest)" },
  ],
  openai: [
    { id: "gpt-6.1-sol", label: "GPT-6.1 Sol (Recommended)" },
    { id: "gpt-6-astra", label: "GPT-6 Astra (Most Capable)" },
    { id: "gpt-6-luna", label: "GPT-6 Luna (Fastest & Affordable)" },
  ],
}

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-6.1-sol",
}

export interface AiSettings {
  provider: AiProvider
  model: string
}

export class MissingAiApiKeyError extends Error {
  code = "missing_ai_api_key" as const
  provider: AiProvider

  constructor(provider: AiProvider) {
    super(
      `No API key configured for ${provider}. Add one in Settings → AI Configuration.`
    )
    this.name = "MissingAiApiKeyError"
    this.provider = provider
  }
}

export interface JobSourceCustomUrl {
  id: string
  label: string
  url: string
  enabled: boolean
}

export interface JobSources {
  adzuna?: { enabled: boolean }
  reed?: { enabled: boolean; api_key?: string }
  careerjet?: { enabled: boolean }
  custom?: JobSourceCustomUrl[]
}

export interface UserPreferences {
  ai_provider?: AiProvider
  ai_model?: string
  ai_billing_source?: "jobclock" | "personal"
  hosted_provider_preference?: "automatic" | AiProvider
  auto_generate_cv_on_job_add?: boolean
  auto_generate_cover_letter_on_job_add?: boolean
  anthropic_api_key?: string
  openai_api_key?: string
  perplexity_api_key?: string
  allow_platform_ai_key?: boolean
  job_sources?: JobSources
}

export function withPlatformAiKeyAccess(
  preferences: UserPreferences | null | undefined,
  allowPlatformAiKey: boolean | null | undefined,
): UserPreferences {
  return {
    ...(preferences ?? {}),
    allow_platform_ai_key: Boolean(allowPlatformAiKey),
  }
}

export function resolveAiSettings(preferences: UserPreferences | null): AiSettings {
  const provider = preferences?.ai_provider ?? "openai"
  const model =
    PROVIDER_MODELS[provider].find(({ id }) => id === preferences?.ai_model)?.id ??
    DEFAULT_MODELS[provider]
  return { provider, model }
}

/** Returns the API key for the given provider.
 *  Priority: stored preference key → allowlisted platform key. */
export function resolveApiKey(
  provider: AiProvider,
  preferences: UserPreferences | null
): string {
  const storedKey =
    provider === "openai"
      ? preferences?.openai_api_key
      : preferences?.anthropic_api_key

  const platformKey =
    preferences?.allow_platform_ai_key
      ? provider === "openai"
        ? process.env.OPENAI_API_KEY
        : process.env.ANTHROPIC_API_KEY
      : null

  const key = (storedKey ? decrypt(storedKey) : null) || platformKey

  if (!key) {
    throw new MissingAiApiKeyError(provider)
  }
  return key
}

export function resolveAiConfig(preferences: UserPreferences | null): {
  settings: AiSettings
  apiKey: string
} {
  const settings = resolveAiSettings(preferences)
  const apiKey = resolveApiKey(settings.provider, preferences)
  return { settings, apiKey }
}

export interface GenerateTextOptions {
  /** Per-request timeout in milliseconds. Defaults to 60_000 (60s). */
  timeoutMs?: number
  /** Max retries inside the SDK. Defaults to 1 — both SDK defaults of 2
   *  silently triple the latency of any slow request. */
  maxRetries?: number
}

export interface GeneratedText {
  text: string
  providerRequestId?: string
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  toolCostMicrousd?: number
}

// Defaults chosen to bound worst-case latency. Both SDKs default to
// maxRetries=2 + ~10-minute timeouts, which silently turns one tail-latency
// spike into a multi-minute hang (seen in the extension preview path).
const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_MAX_RETRIES = 1

// Conservative flat price per web search (microUSD), above both providers' list prices; revisit with AI_PRICE_VERSION.
export const WEB_SEARCH_COST_MICROUSD = 25_000

export async function generateTextWithWebSearch(
  settings: AiSettings,
  apiKey: string,
  system: string,
  user: string,
  maxTokens?: number,
  options?: GenerateTextOptions,
): Promise<string> {
  return (await generateTextWithWebSearchResult(settings, apiKey, system, user, maxTokens, options)).text
}

export async function generateTextWithWebSearchResult(
  settings: AiSettings,
  apiKey: string,
  system: string,
  user: string,
  maxTokens?: number,
  options?: GenerateTextOptions,
): Promise<GeneratedText> {
  // Web search calls are slow (search + synthesis). 240 s gives headroom
  // inside the 300 s Vercel maxDuration on the generate route.
  const timeout = options?.timeoutMs ?? 240_000
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES

  try {
    if (settings.provider === "anthropic") {
      const { default: Anthropic } = await import("@anthropic-ai/sdk")
      const client = new Anthropic({ apiKey, timeout, maxRetries })
      const message = await client.messages.create(
        {
          model: settings.model,
          max_tokens: maxTokens ?? 4096,
          system,
          messages: [{ role: "user", content: user }],
          tools: [{ type: "web_search_20250305", name: "web_search" }],
        },
        { headers: { "anthropic-beta": "web-search-2025-03-05" } },
      )
      const searches = (message.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0
      // Response may include server_tool_use blocks alongside text blocks — extract text only.
      return {
        text: message.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { type: "text"; text: string }).text)
          .join("\n"),
        providerRequestId: message.id,
        inputTokens: message.usage.input_tokens,
        cachedInputTokens: message.usage.cache_read_input_tokens ?? 0,
        outputTokens: message.usage.output_tokens,
        toolCostMicrousd: searches * WEB_SEARCH_COST_MICROUSD,
      }
    } else {
      const { default: OpenAI } = await import("openai")
      const client = new OpenAI({ apiKey, timeout, maxRetries })
      const response = await client.responses.create({
        model: settings.model,
        instructions: system,
        input: user,
        tools: [{ type: "web_search_preview" }],
        ...(maxTokens != null ? { max_output_tokens: maxTokens } : {}),
      })
      const searches = response.output.filter((item) => item.type === "web_search_call").length
      return {
        text: response.output_text,
        providerRequestId: response.id,
        inputTokens: response.usage?.input_tokens ?? 0,
        cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        toolCostMicrousd: searches * WEB_SEARCH_COST_MICROUSD,
      }
    }
  } catch {
    // Web search not supported by this model or API error — fall back to plain generation.
    return generateTextResult(settings, apiKey, system, user, maxTokens, options)
  }
}

export async function generateText(
  settings: AiSettings,
  apiKey: string,
  system: string,
  user: string,
  maxTokens?: number,
  options?: GenerateTextOptions,
): Promise<string> {
  return (await generateTextResult(settings, apiKey, system, user, maxTokens, options)).text
}

export async function generateTextResult(
  settings: AiSettings,
  apiKey: string,
  system: string,
  user: string,
  maxTokens?: number,
  options?: GenerateTextOptions,
): Promise<GeneratedText> {
  const timeout = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES

  if (settings.provider === "anthropic") {
    const { default: Anthropic } = await import("@anthropic-ai/sdk")
    const client = new Anthropic({ apiKey, timeout, maxRetries })
    const message = await client.messages.create({
      model: settings.model,
      max_tokens: maxTokens ?? 4096,
      system,
      messages: [{ role: "user", content: user }],
    })
    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
    if (!text) throw new Error("Unexpected Anthropic response type")
    return {
      text,
      providerRequestId: message.id,
      inputTokens: message.usage.input_tokens,
      cachedInputTokens: message.usage.cache_read_input_tokens ?? 0,
      outputTokens: message.usage.output_tokens,
    }
  } else {
    const { default: OpenAI } = await import("openai")
    const client = new OpenAI({ apiKey, timeout, maxRetries })
    // GPT-6 and o-series models use max_completion_tokens.
    const isReasoning =
      settings.model.startsWith("gpt-6") ||
      settings.model.startsWith("o3") ||
      settings.model.startsWith("o4")
    const tokenParam = maxTokens != null
      ? (isReasoning ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens })
      : {}
    const completion = await client.chat.completions.create({
      model: settings.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...tokenParam,
    })
    return {
      text: completion.choices[0]?.message?.content ?? "",
      providerRequestId: completion.id,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      cachedInputTokens: completion.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    }
  }
}
