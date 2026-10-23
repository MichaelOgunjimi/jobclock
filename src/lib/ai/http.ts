import { MissingAiApiKeyError } from "./index"
import { AiAllowanceExhaustedError } from "@/lib/billing/usage"

/** Maps an AI action failure to a JSON response: 422 missing key, 402 allowance used, otherwise `fallbackStatus`. */
export function aiErrorResponse(error: unknown, fallbackMessage: string, fallbackStatus = 500): Response {
  if (error instanceof MissingAiApiKeyError) {
    return Response.json({ error: error.message, code: error.code }, { status: 422 })
  }
  if (error instanceof AiAllowanceExhaustedError) {
    return Response.json({ error: error.message, code: error.code }, { status: 402 })
  }
  return Response.json(
    { error: error instanceof Error ? error.message : fallbackMessage },
    { status: fallbackStatus },
  )
}
