import "server-only"

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
  "incomplete_expired",
  "canceled",
] as const

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number]

export interface SubscriptionProjection {
  status: SubscriptionStatus
  graceEndsAt?: Date | null
}

export interface Entitlement {
  plan: "free" | "pro"
  hostedAi: boolean
  inGracePeriod: boolean
}

export function resolveEntitlement(
  subscription: SubscriptionProjection | null,
  allowPlatformAiKey = false,
  now = new Date(),
): Entitlement {
  if (subscription?.status === "active" || subscription?.status === "trialing") {
    return { plan: "pro", hostedAi: true, inGracePeriod: false }
  }

  const inGracePeriod = subscription?.status === "past_due"
    && !!subscription.graceEndsAt
    && subscription.graceEndsAt > now

  return {
    plan: inGracePeriod ? "pro" : "free",
    hostedAi: allowPlatformAiKey,
    inGracePeriod,
  }
}
