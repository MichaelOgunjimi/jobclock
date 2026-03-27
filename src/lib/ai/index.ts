export type AiProvider = "anthropic" | "openai"

export const PROVIDER_MODELS: Record<AiProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (Recommended)" },
    { id: "claude-opus-4-6", label: "Claude Opus 4.6 (Most Capable)" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (Fastest)" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o (Most Capable)" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini (Fast & Affordable)" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
  ],
}

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o-mini",
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
  custom?: JobSourceCustomUrl[]
}

export interface UserPreferences {
  ai_provider?: AiProvider
  ai_model?: string
  anthropic_api_key?: string
  openai_api_key?: string
  job_sources?: JobSources
}

export function resolveAiSettings(preferences: UserPreferences | null): AiSettings {
  const provider = preferences?.ai_provider ?? "anthropic"
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
    provider === "anthropic"
      ? preferences?.anthropic_api_key
      : preferences?.openai_api_key

  const envKey =
    provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.OPENAI_API_KEY

  const key = storedKey || envKey

  if (!key) {
    throw new Error(
      `No API key for ${provider}. Add one in Settings or set the ${
        provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"
      } environment variable.`
    )
  }
  return key
}

export async function generateText(
  settings: AiSettings,
  apiKey: string,
  system: string,
  user: string
): Promise<string> {
  if (settings.provider === "anthropic") {
    const { default: Anthropic } = await import("@anthropic-ai/sdk")
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: settings.model,
      max_tokens: 4096,
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
    })
    return completion.choices[0]?.message?.content ?? ""
  }
}
