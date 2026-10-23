import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient, getCurrentUser } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { DashboardShell } from "@/components/dashboard-shell"
import { GenerationJobsProvider } from "@/components/generation-jobs-provider"
import { resolveAiSettings, type UserPreferences } from "@/lib/ai"
import { resolveEntitlement, SUBSCRIPTION_STATUSES, type SubscriptionStatus } from "@/lib/billing/entitlements"
import { hasPersonalApiTokenHistory } from "@/lib/personal-api-tokens"
import { isSidebarCollapsed, SIDEBAR_COLLAPSED_KEY } from "@/lib/sidebar-preference"

// Every page under (dashboard) is behind auth. Tell crawlers not to
// index them so accidental URL leaks (shared links, referer headers)
// can't pollute search results with login walls.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!isSupabaseConfigured()) {
    redirect("/auth")
  }

  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth")
  }

  const cookieStore = await cookies()
  const initialSidebarCollapsed = isSidebarCollapsed(
    cookieStore.get(SIDEBAR_COLLAPSED_KEY)?.value
  )

  const [{ data: profile }, { data: subscription }, hasExtensionTokenHistory] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url, preferences, allow_platform_ai_key")
      .eq("id", user.id)
      .single(),
    supabase.from("billing_subscriptions").select("status, grace_ends_at").eq("user_id", user.id).maybeSingle(),
    hasPersonalApiTokenHistory(user.id),
  ])
  const preferences = (profile?.preferences ?? null) as UserPreferences | null
  const aiSettings = resolveAiSettings(preferences)
  const canUsePlatformAiKey = profile?.allow_platform_ai_key === true
  const hasSelectedProviderKey =
    aiSettings.provider === "openai"
      ? Boolean(preferences?.openai_api_key || (canUsePlatformAiKey && process.env.OPENAI_API_KEY))
      : Boolean(preferences?.anthropic_api_key || (canUsePlatformAiKey && process.env.ANTHROPIC_API_KEY))
  const status = SUBSCRIPTION_STATUSES.includes(subscription?.status as SubscriptionStatus)
    ? subscription?.status as SubscriptionStatus
    : null
  const { hostedAi } = resolveEntitlement(
    status ? { status, graceEndsAt: subscription?.grace_ends_at ? new Date(subscription.grace_ends_at) : null } : null,
    canUsePlatformAiKey,
  )
  const hasPersonalKey = Boolean(preferences?.anthropic_api_key || preferences?.openai_api_key)
  // Same rule as Settings: a Pro user generates with JobClock credits unless they chose their own key.
  const usesJobclockAi = hostedAi && (preferences?.ai_billing_source ?? (hasPersonalKey ? "personal" : "jobclock")) === "jobclock"
  const providerLabel = aiSettings.provider === "openai" ? "OpenAI" : "Anthropic"

  return (
    <GenerationJobsProvider userId={user.id}>
      <DashboardShell
        initialSidebarCollapsed={initialSidebarCollapsed}
        aiKeyBanner={
          hasSelectedProviderKey || usesJobclockAi ? null : { providerLabel }
        }
        showExtensionBanner={!hasExtensionTokenHistory}
        userProfile={{
          email: user.email ?? "",
          fullName: profile?.full_name ?? null,
          avatarUrl: profile?.avatar_url ?? null,
        }}
      >
        {children}
      </DashboardShell>
    </GenerationJobsProvider>
  )
}
