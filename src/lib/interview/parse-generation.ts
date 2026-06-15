import { z } from "zod"

const discoveryDraftSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("story_found"),
    story: z.object({
      title: z.string().trim().min(1),
      situation: z.string().trim(),
      task: z.string().trim(),
      action: z.string().trim(),
      result: z.string().trim(),
      tags: z.array(z.string().trim().min(1)).max(8),
    }),
  }),
  z.object({
    outcome: z.literal("partial_evidence"),
    honestAnswer: z.string().trim().min(1),
    limitations: z.string().trim().min(1),
  }),
  z.object({
    outcome: z.literal("no_example"),
    honestAnswer: z.string().trim().min(1),
    hypotheticalApproach: z.string().trim().min(1),
  }),
])

export type DiscoveryDraft = z.infer<typeof discoveryDraftSchema>

function unwrapJson(value: string): string {
  const trimmed = value.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced?.[1] ?? trimmed
}

export function parseDiscoveryDraft(value: string): DiscoveryDraft {
  try {
    const parsed = JSON.parse(unwrapJson(value))
    const result = discoveryDraftSchema.safeParse(parsed)
    if (result.success) return result.data
  } catch {
    // The caller gets one stable error for malformed and invalid AI output.
  }

  throw new Error("AI returned an invalid discovery draft")
}
