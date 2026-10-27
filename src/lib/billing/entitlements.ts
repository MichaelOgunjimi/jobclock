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

export interface PlanGrant {
  kind: "lifetime" | "comp"
  expiresAt?: Date | null
}

export interface Entitlement {
  plan: "free" | "pro"
  hostedAi: boolean
  inGracePeriod: boolean
  /** True when Pro comes from a grant with no Stripe subscription behind it. */
  granted: boolean
}

export const toPlanGrant = (row: { kind: string; expires_at: string | null } | null): PlanGrant | null =>
  row ? { kind: row.kind as PlanGrant["kind"], expiresAt: row.expires_at ? new Date(row.expires_at) : null } : null

export const isGrantActive = (grant: PlanGrant | null | undefined, now = new Date()) =>
  Boolean(grant && (!grant.expiresAt || grant.expiresAt > now))

export function resolveEntitlement(
  subscription: SubscriptionProjection | null,
  allowPlatformAiKey = false,
  now = new Date(),
  grant: PlanGrant | null = null,
): Entitlement {
  if (isGrantActive(grant, now)) return { plan: "pro", hostedAi: true, inGracePeriod: false, granted: true }

  if (subscription?.status === "active" || subscription?.status === "trialing") {
    return { plan: "pro", hostedAi: true, inGracePeriod: false, granted: false }
  }

  const inGracePeriod = subscription?.status === "past_due"
    && !!subscription.graceEndsAt
    && subscription.graceEndsAt > now

  return {
    plan: inGracePeriod ? "pro" : "free",
    hostedAi: allowPlatformAiKey,
    inGracePeriod,
    granted: false,
  }
}
