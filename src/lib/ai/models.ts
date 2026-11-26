// Client-safe model catalogue. Kept apart from ./index so client components can import it
// without pulling in the server-only crypto code that index.ts needs.
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
