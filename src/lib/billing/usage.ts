import "server-only"

import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { aiCreditBalances, aiCreditPurchases, aiUsageActions, aiUsageEvents, aiUsagePeriods } from "@/lib/db/schema"
import type { AiFeature, CreditPackId } from "./plans"

export class AiAllowanceExhaustedError extends Error {
  readonly code = "ai_allowance_exhausted" as const

  constructor(readonly resetAt: Date) {
    super("Your JobClock AI allowance has been used for this billing period. Buy more credits in Settings or wait for it to reset.")
    this.name = "AiAllowanceExhaustedError"
  }
}

type Period = {
  start: Date
  end: Date
  creditLimit: number
  costLimitMicrousd: number
}

export type ProviderUsage = {
  providerRequestId?: string
  provider: "openai" | "anthropic"
  model: string
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  toolCostMicrousd?: number
  totalCostMicrousd: number
  priceVersion: string
}

// The cost ceiling only counts the allowance-funded share of an action; purchased credits are paid for separately.
const allowanceShare = (cost: number, allowanceCredits: number, credits: number) =>
  allowanceCredits >= credits ? cost : Math.round(cost * allowanceCredits / credits)

export async function reserveHostedAiAction(input: {
  userId: string
  idempotencyKey: string
  feature: AiFeature
  credits: number
  estimatedCostMicrousd: number
  period: Period
}) {
  return db.transaction(async (tx) => {
    await tx.insert(aiUsagePeriods).values({
      userId: input.userId,
      periodStart: input.period.start,
      periodEnd: input.period.end,
      creditLimit: input.period.creditLimit,
      costLimitMicrousd: input.period.costLimitMicrousd,
    }).onConflictDoNothing()

    let [action] = await tx.insert(aiUsageActions).values({
      idempotencyKey: input.idempotencyKey,
      userId: input.userId,
      periodStart: input.period.start,
      feature: input.feature,
      credentialSource: "jobclock",
      status: "reserved",
      credits: input.credits,
      estimatedCostMicrousd: input.estimatedCostMicrousd,
    }).onConflictDoNothing().returning()

    if (!action) {
      const [existing] = await tx.select().from(aiUsageActions)
        .where(eq(aiUsageActions.idempotencyKey, input.idempotencyKey))
        .limit(1)
      if (!existing || existing.userId !== input.userId || existing.feature !== input.feature) {
        throw new Error("AI action idempotency key is already in use")
      }
      // A released (failed) action may be retried under the same key, e.g. a QStash job retry; re-reserve it below.
      if (existing.status !== "failed") return existing
      action = existing
    }

    // The monthly allowance is spent first; purchased credits cover whatever part of an action it can't.
    let allowanceCredits = input.credits
    let allowanceEstimate = input.estimatedCostMicrousd
    const reserveAllowance = async (credits: number, estimate: number) => {
      const [reserved] = await tx.update(aiUsagePeriods).set({
        creditsReserved: sql`${aiUsagePeriods.creditsReserved} + ${credits}`,
        costReservedMicrousd: sql`${aiUsagePeriods.costReservedMicrousd} + ${estimate}`,
        updatedAt: new Date(),
      }).where(and(
        eq(aiUsagePeriods.userId, input.userId),
        eq(aiUsagePeriods.periodStart, input.period.start),
        sql`${aiUsagePeriods.creditsReserved} + ${aiUsagePeriods.creditsUsed} + ${credits} <= ${aiUsagePeriods.creditLimit}`,
        sql`${aiUsagePeriods.costReservedMicrousd} + ${aiUsagePeriods.costUsedMicrousd} + ${estimate} <= ${aiUsagePeriods.costLimitMicrousd}`,
      )).returning()
      return Boolean(reserved)
    }

    if (!await reserveAllowance(input.credits, input.estimatedCostMicrousd)) {
      // Take whatever the allowance has left (credits and cost ceiling) and charge the rest to purchased credits.
      const [period] = await tx.select().from(aiUsagePeriods).where(and(
        eq(aiUsagePeriods.userId, input.userId),
        eq(aiUsagePeriods.periodStart, input.period.start),
      )).limit(1)
      const creditsLeft = period ? period.creditLimit - period.creditsReserved - period.creditsUsed : 0
      const costLeft = period ? period.costLimitMicrousd - period.costReservedMicrousd - period.costUsedMicrousd : 0
      const affordable = Math.floor(input.credits * Math.max(costLeft, 0) / Math.max(input.estimatedCostMicrousd, 1))
      allowanceCredits = Math.max(0, Math.min(input.credits - 1, creditsLeft, affordable))
      allowanceEstimate = Math.floor(input.estimatedCostMicrousd * allowanceCredits / input.credits)
      if (allowanceCredits > 0 && !await reserveAllowance(allowanceCredits, allowanceEstimate)) {
        allowanceCredits = 0
        allowanceEstimate = 0
      }
      const purchasedCredits = input.credits - allowanceCredits
      const [purchased] = await tx.update(aiCreditBalances).set({
        credits: sql`${aiCreditBalances.credits} - ${purchasedCredits}`,
        updatedAt: new Date(),
      }).where(and(
        eq(aiCreditBalances.userId, input.userId),
        sql`${aiCreditBalances.credits} >= ${purchasedCredits}`,
      )).returning()
      // Throwing rolls back any allowance already reserved above.
      if (!purchased) throw new AiAllowanceExhaustedError(input.period.end)
    }

    const purchasedCredits = input.credits - allowanceCredits
    const funding = purchasedCredits === input.credits ? "purchased" : "allowance"
    if (action.status === "failed") {
      const [requeued] = await tx.update(aiUsageActions).set({
        status: "reserved",
        funding,
        purchasedCredits,
        periodStart: input.period.start,
        credits: input.credits,
        estimatedCostMicrousd: allowanceEstimate,
        actualCostMicrousd: 0,
        settledAt: null,
      }).where(eq(aiUsageActions.id, action.id)).returning()
      action = requeued
    } else if (purchasedCredits > 0) {
      const [funded] = await tx.update(aiUsageActions).set({ funding, purchasedCredits, estimatedCostMicrousd: allowanceEstimate })
        .where(eq(aiUsageActions.id, action.id)).returning()
      action = funded
    }
    return action
  })
}

export async function settleHostedAiAction(actionId: string, events: ProviderUsage[]) {
  const actualCost = events.reduce((sum, event) => sum + event.totalCostMicrousd, 0)
  const inputTokens = events.reduce((sum, event) => sum + event.inputTokens, 0)
  const cachedInputTokens = events.reduce((sum, event) => sum + event.cachedInputTokens, 0)
  const outputTokens = events.reduce((sum, event) => sum + event.outputTokens, 0)

  return db.transaction(async (tx) => {
    const [action] = await tx.update(aiUsageActions).set({
      status: "completed",
      actualCostMicrousd: actualCost,
      inputTokens,
      cachedInputTokens,
      outputTokens,
      settledAt: new Date(),
    }).where(and(eq(aiUsageActions.id, actionId), eq(aiUsageActions.status, "reserved"))).returning()
    if (!action) return

    if (events.length) {
      await tx.insert(aiUsageEvents).values(events.map((event) => ({
        actionId,
        ...event,
        toolCostMicrousd: event.toolCostMicrousd ?? 0,
      }))).onConflictDoNothing()
    }

    // Purchased credits were taken from the balance at reservation; only the allowance part touches the monthly counters.
    const allowanceCredits = action.credits - action.purchasedCredits
    if (allowanceCredits <= 0) return

    await tx.update(aiUsagePeriods).set({
      creditsReserved: sql`${aiUsagePeriods.creditsReserved} - ${allowanceCredits}`,
      creditsUsed: sql`${aiUsagePeriods.creditsUsed} + ${allowanceCredits}`,
      costReservedMicrousd: sql`${aiUsagePeriods.costReservedMicrousd} - ${action.estimatedCostMicrousd}`,
      costUsedMicrousd: sql`${aiUsagePeriods.costUsedMicrousd} + ${allowanceShare(actualCost, allowanceCredits, action.credits)}`,
      updatedAt: new Date(),
    }).where(and(
      eq(aiUsagePeriods.userId, action.userId),
      eq(aiUsagePeriods.periodStart, action.periodStart),
    ))
  })
}

export async function releaseHostedAiAction(actionId: string, incurred: ProviderUsage[] = []) {
  const actualCost = incurred.reduce((sum, event) => sum + event.totalCostMicrousd, 0)
  return db.transaction(async (tx) => {
    const [action] = await tx.update(aiUsageActions).set({
      status: "failed",
      actualCostMicrousd: actualCost,
      settledAt: new Date(),
    }).where(and(eq(aiUsageActions.id, actionId), eq(aiUsageActions.status, "reserved"))).returning()
    if (!action) return

    if (incurred.length) {
      await tx.insert(aiUsageEvents).values(incurred.map((event) => ({
        actionId,
        ...event,
        toolCostMicrousd: event.toolCostMicrousd ?? 0,
      }))).onConflictDoNothing()
    }

    if (action.purchasedCredits > 0) {
      await tx.update(aiCreditBalances).set({
        credits: sql`${aiCreditBalances.credits} + ${action.purchasedCredits}`,
        updatedAt: new Date(),
      }).where(eq(aiCreditBalances.userId, action.userId))
    }

    const allowanceCredits = action.credits - action.purchasedCredits
    if (allowanceCredits <= 0) return

    await tx.update(aiUsagePeriods).set({
      creditsReserved: sql`${aiUsagePeriods.creditsReserved} - ${allowanceCredits}`,
      costReservedMicrousd: sql`${aiUsagePeriods.costReservedMicrousd} - ${action.estimatedCostMicrousd}`,
      costUsedMicrousd: sql`${aiUsagePeriods.costUsedMicrousd} + ${allowanceShare(actualCost, allowanceCredits, action.credits)}`,
      updatedAt: new Date(),
    }).where(and(
      eq(aiUsagePeriods.userId, action.userId),
      eq(aiUsagePeriods.periodStart, action.periodStart),
    ))
  })
}

/** Adds a paid credit pack to the user's balance. Safe to call again for the same Checkout Session. */
export async function grantPurchasedCredits(input: {
  userId: string
  checkoutSessionId: string
  pack: CreditPackId
  credits: number
  amountPence: number
}): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [purchase] = await tx.insert(aiCreditPurchases).values({
      userId: input.userId,
      stripeCheckoutSessionId: input.checkoutSessionId,
      pack: input.pack,
      credits: input.credits,
      amountPence: input.amountPence,
    }).onConflictDoNothing().returning()
    if (!purchase) return false

    await tx.insert(aiCreditBalances).values({ userId: input.userId, credits: input.credits })
      .onConflictDoUpdate({
        target: aiCreditBalances.userId,
        set: { credits: sql`${aiCreditBalances.credits} + ${input.credits}`, updatedAt: new Date() },
      })
    return true
  })
}
