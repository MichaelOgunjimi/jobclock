import type { Metadata } from "next"
import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { KeyRound } from "lucide-react"
import { createClient, getCurrentUser } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { DashboardShell } from "@/components/dashboard-shell"
import { GenerationJobsProvider } from "@/components/generation-jobs-provider"
import { ExtensionAvailabilityBanner } from "@/components/extension-availability-banner"
import { UpgradeDialog } from "@/components/upgrade-dialog"
import { buttonVariants } from "@/components/ui/button-styles"
import { resolveAiSettings, type UserPreferences } from "@/lib/ai"
import { resolveEntitlement, SUBSCRIPTION_STATUSES, toPlanGrant, type SubscriptionStatus } from "@/lib/billing/entitlements"
import { hasPersonalApiTokenHistory } from "@/lib/personal-api-tokens"
import { isSidebarCollapsed, SIDEBAR_COLLAPSED_KEY } from "@/lib/sidebar-preference"
import { cn } from "@/lib/utils"

// Every page under (dashboard) is behind auth. Tell crawlers not to
// index them so accidental URL leaks (shared links, referer headers)
// can't pollute search results with login walls.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

type BannerData = Awaited<ReturnType<typeof loadBannerData>>

function loadBannerData(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return Promise.all([
    supabase.from("billing_subscriptions").select("status, grace_ends_at").eq("user_id", userId).maybeSingle(),
    supabase.from("billing_grants").select("kind, expires_at").eq("user_id", userId).maybeSingle(),
    hasPersonalApiTokenHistory(userId),
  ])
}

async function DashboardBanners({
  bannerData,
  canUsePlatformAiKey,
  preferences,
}: {
  bannerData: Promise<BannerData>
  canUsePlatformAiKey: boolean
  preferences: UserPreferences | null
}) {
  const [{ data: subscription }, { data: grantRow }, hasExtensionTokenHistory] = await bannerData
  const aiSettings = resolveAiSettings(preferences)
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
    new Date(),
    toPlanGrant(grantRow),
  )
  const hasPersonalKey = Boolean(preferences?.anthropic_api_key || preferences?.openai_api_key)
  const usesJobclockAi = hostedAi && (preferences?.ai_billing_source ?? (hasPersonalKey ? "personal" : "jobclock")) === "jobclock"
  const providerLabel = aiSettings.provider === "openai" ? "OpenAI" : "Anthropic"

  return (
    <>
      {!hasSelectedProviderKey && !usesJobclockAi && (
        <div className="border-b bg-secondary/45 px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center border bg-background">
                <KeyRound className="size-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  Configure a {providerLabel} API key to enable AI generation.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Add your own provider key in Settings, or see Pro for AI generation without a separate provider account.
                </p>
              </div>
            </div>
            <Link
              href="/settings?tab=ai"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "bg-background")}
            >
              Configure AI key
            </Link>
            <UpgradeDialog className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}>
              See Pro
            </UpgradeDialog>
          </div>
        </div>
      )}
      {!hasExtensionTokenHistory && (
        <div className="border-b px-4 py-3 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1440px]">
            <ExtensionAvailabilityBanner compact />
          </div>
        </div>
      )}
    </>
  )
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

  const profilePromise = supabase
    .from("profiles")
    .select("full_name, avatar_url, preferences, allow_platform_ai_key")
    .eq("id", user.id)
    .single()
  const bannerData = loadBannerData(supabase, user.id)
  const { data: profile } = await profilePromise
  const preferences = (profile?.preferences ?? null) as UserPreferences | null
  const canUsePlatformAiKey = profile?.allow_platform_ai_key === true

  return (
    <GenerationJobsProvider userId={user.id}>
      <DashboardShell
        banners={
          <Suspense fallback={null}>
            <DashboardBanners
              bannerData={bannerData}
              canUsePlatformAiKey={canUsePlatformAiKey}
              preferences={preferences}
            />
          </Suspense>
        }
        initialSidebarCollapsed={initialSidebarCollapsed}
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
