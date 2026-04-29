import { decrypt } from "@/lib/crypto"

export type AiProvider = "anthropic" | "openai"

export const PROVIDER_MODELS: Record<AiProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Recommended)" },
    { id: "claude-opus-4-6", label: "Claude Opus 4.6 (Most Capable)" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (Fastest)" },
  ],
  openai: [
    { id: "o3", label: "o3 (Most capable)" },
    { id: "o4-mini", label: "o4-mini (Fast reasoning)" },
    { id: "gpt-4.1", label: "GPT-4.1" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini (Fast & affordable)" },
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  ],
}

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4.1-mini",
}

export interface AiSettings {
  provider: AiProvider
  model: string
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
  anthropic_api_key?: string
  openai_api_key?: string
  perplexity_api_key?: string
  job_sources?: JobSources
}

export function resolveAiSettings(preferences: UserPreferences | null): AiSettings {
  const provider = preferences?.ai_provider ?? "openai"
  const model = preferences?.ai_model ?? DEFAULT_MODELS[provider]
  return { provider, model }
}

/** Returns the API key for the given provider.
 *  Priority: stored preference key → environment variable */
export function resolveApiKey(
  provider: AiProvider,
  preferences: UserPreferences | null
): string {
  const storedKey =
		provider === "openai" ?
			preferences?.openai_api_key
		:	preferences?.anthropic_api_key;

  const envKey =
		provider === "openai" ?
			process.env.OPENAI_API_KEY
		:	process.env.ANTHROPIC_API_KEY;

  const key = (storedKey ? decrypt(storedKey) : null) || envKey

  if (!key) {
    throw new Error(
      `No API key configured for ${provider}. Add one in Settings → AI Configuration.`
    )
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

export async function generateText(
  settings: AiSettings,
  apiKey: string,
  system: string,
  user: string,
  maxTokens?: number
): Promise<string> {
  if (settings.provider === "anthropic") {
    const { default: Anthropic } = await import("@anthropic-ai/sdk")
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: settings.model,
      max_tokens: maxTokens ?? 4096,
      system,
      messages: [{ role: "user", content: user }],
    })
    const block = message.content[0]
    if (block.type !== "text") throw new Error("Unexpected Anthropic response type")
    return block.text
  } else {
    const { default: OpenAI } = await import("openai")
    const client = new OpenAI({ apiKey })
    const completion = await client.chat.completions.create({
      model: settings.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(maxTokens != null ? { max_tokens: maxTokens } : {}),
    })
    return completion.choices[0]?.message?.content ?? ""
  }
}
