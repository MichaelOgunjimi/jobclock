// Perplexity API client using the OpenAI-compatible endpoint.
// Model: sonar (fast, with citations) or sonar-pro (deeper research).
// Resolve the API key at the call site; pass it explicitly via options.

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"

export interface PerplexityMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface PerplexityOptions {
  apiKey: string
  model?: "sonar" | "sonar-pro" | "sonar-reasoning"
  maxTokens?: number
  temperature?: number
}

export async function callPerplexity(
  messages: PerplexityMessage[],
  options: PerplexityOptions,
): Promise<string> {
  const { apiKey, model = "sonar", maxTokens = 3500, temperature = 0.2 } = options

  const res = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Perplexity API error ${res.status}: ${body.slice(0, 300)}`)
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>
  }

  return data.choices[0]?.message?.content ?? ""
}
