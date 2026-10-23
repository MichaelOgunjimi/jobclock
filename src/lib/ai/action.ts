import "server-only"

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { billingSubscriptions } from "@/lib/db/schema"
import { resolveEntitlement, type SubscriptionStatus } from "@/lib/billing/entitlements"
import { AI_PRICE_VERSION, calculateProviderCostMicrousd, type HostedModel } from "@/lib/billing/provider-costs"
import { getCreditWeight, getHostedModel, PRO_COST_LIMIT_MICROUSD, PRO_CREDIT_LIMIT, type AiFeature } from "@/lib/billing/plans"
import { releaseHostedAiAction, reserveHostedAiAction, settleHostedAiAction, type ProviderUsage } from "@/lib/billing/usage"
import {
  generateTextResult,
  generateTextWithWebSearchResult,
  resolveAiConfig,
  type AiSettings,
  type GeneratedText,
  type GenerateTextOptions,
  type UserPreferences,
} from "./index"

export type AiActionRequest = {
  userId: string
  actionId: string
  feature: AiFeature
  preferences: UserPreferences | null
}

export type AiActionClient = {
  generate(system: string, user: string, maxTokens?: number, options?: GenerateTextOptions): Promise<string>
  generateWithWebSearch(system: string, user: string, maxTokens?: number, options?: GenerateTextOptions): Promise<string>
  /** For callers that use a provider SDK directly (e.g. file attachments): resolved model and key, plus usage reporting. */
  settings: AiSettings
  apiKey: string
  record(usage: GeneratedText): void
}

const ESTIMATED_COSTS: Record<AiFeature, number> = {
  job_import: 20_000, qualification_document_extraction: 30_000, cv_parse_review: 80_000,
  application_chat: 100_000, interview_answer: 60_000, interview_preparation: 120_000,
  cover_letter: 120_000, company_research: 200_000, cv_tailoring: 500_000,
}

export async function runAiAction<T>(request: AiActionRequest, operation: (ai: AiActionClient) => Promise<T>): Promise<T> {
  const [subscription] = await db.select().from(billingSubscriptions)
    .where(and(eq(billingSubscriptions.userId, request.userId)))
    .limit(1)
  const entitlement = resolveEntitlement(subscription ? {
    status: subscription.status as SubscriptionStatus,
    graceEndsAt: subscription.graceEndsAt,
  } : null, request.preferences?.allow_platform_ai_key)

  const hasPersonalKey = Boolean(request.preferences?.openai_api_key || request.preferences?.anthropic_api_key)
  const wantsHosted = request.preferences?.ai_billing_source === "jobclock"
    || (!request.preferences?.ai_billing_source && entitlement.hostedAi && !hasPersonalKey)

  if (!wantsHosted || !entitlement.hostedAi) {
    const { settings, apiKey } = resolveAiConfig({ ...request.preferences, allow_platform_ai_key: false })
    return operation({
      generate: async (system, user, maxTokens, options) =>
        (await generateTextResult(settings, apiKey, system, user, maxTokens, options)).text,
      generateWithWebSearch: async (system, user, maxTokens, options) =>
        (await generateTextWithWebSearchResult(settings, apiKey, system, user, maxTokens, options)).text,
      settings,
      apiKey,
      record: () => {},
    })
  }

  const settings = getHostedModel(request.feature, request.preferences?.hosted_provider_preference)
  const apiKey = settings.provider === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error(`JobClock ${settings.provider} API key is not configured`)
  const now = new Date()
  const period = subscription && ["active", "trialing"].includes(subscription.status)
    ? { start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd }
    : { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) }
  const action = await reserveHostedAiAction({
    userId: request.userId, idempotencyKey: request.actionId, feature: request.feature,
    credits: getCreditWeight(request.feature), estimatedCostMicrousd: ESTIMATED_COSTS[request.feature],
    period: { ...period, creditLimit: PRO_CREDIT_LIMIT, costLimitMicrousd: PRO_COST_LIMIT_MICROUSD },
  })
  if (action.status !== "reserved") throw new Error("AI action has already been processed")

  const events: ProviderUsage[] = []
  const record = (generated: GeneratedText) => {
    events.push({
      provider: settings.provider,
      model: settings.model,
      providerRequestId: generated.providerRequestId,
      inputTokens: generated.inputTokens,
      cachedInputTokens: generated.cachedInputTokens,
      outputTokens: generated.outputTokens,
      toolCostMicrousd: generated.toolCostMicrousd ?? 0,
      totalCostMicrousd: calculateProviderCostMicrousd({ model: settings.model as HostedModel, ...generated }),
      priceVersion: AI_PRICE_VERSION,
    })
  }
  try {
    const result = await operation({
      generate: async (system, user, maxTokens, options) => {
        const generated = await generateTextResult(settings, apiKey, system, user, maxTokens, options)
        record(generated)
        return generated.text
      },
      generateWithWebSearch: async (system, user, maxTokens, options) => {
        const generated = await generateTextWithWebSearchResult(settings, apiKey, system, user, maxTokens, options)
        record(generated)
        return generated.text
      },
      settings,
      apiKey,
      record,
    })
    await settleHostedAiAction(action.id, events)
    return result
  } catch (error) {
    await releaseHostedAiAction(action.id, events)
    throw error
  }
}
