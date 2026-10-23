import type { Metadata } from "next"
import { Suspense } from "react"
import { createClient, getCurrentUser } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { redirect } from "next/navigation"
import { resolveAiSettings, type UserPreferences, type JobSources } from "@/lib/ai"
import { getActivePersonalApiTokenMetadata } from "@/lib/personal-api-tokens"
import { getTelegramConnection } from "@/lib/telegram/pairing"
import { listTrackedCompanies } from "./actions"
import { SettingsTabs } from "./settings-tabs"
import { allowanceWindow, CREDIT_PACKS, PRO_CREDIT_LIMIT } from "@/lib/billing/plans"
import { resolveEntitlement, SUBSCRIPTION_STATUSES, toPlanGrant, type SubscriptionStatus } from "@/lib/billing/entitlements"

export const metadata: Metadata = {
  title: "Settings",
}

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) redirect("/auth")

  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) redirect("/auth")

  const [
    { data: profile },
    { data: profileData },
    extensionToken,
    telegramConnection,
    companies,
    { data: subscription },
    { data: grantRow },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("preferences, allow_platform_ai_key")
      .eq("id", user.id)
      .single(),
    supabase
      .from("profiles")
      .select("desired_roles, locations_uk, target_salary_min, right_to_work_uk, experience_level")
      .eq("id", user.id)
      .single(),
    getActivePersonalApiTokenMetadata(user.id),
    getTelegramConnection(user.id),
    listTrackedCompanies(),
    supabase
      .from("billing_subscriptions")
      .select("status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, grace_ends_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("billing_grants").select("kind, expires_at").eq("user_id", user.id).maybeSingle(),
  ])

  const subscriptionStatus = SUBSCRIPTION_STATUSES.includes(subscription?.status as SubscriptionStatus)
    ? subscription?.status as SubscriptionStatus
    : null
  const entitlement = resolveEntitlement(subscriptionStatus ? {
    status: subscriptionStatus,
    graceEndsAt: subscription?.grace_ends_at ? new Date(subscription.grace_ends_at) : null,
  } : null, profile?.allow_platform_ai_key === true, new Date(), toPlanGrant(grantRow))
  const isPro = entitlement.plan === "pro"
  const allowance = subscription?.current_period_start && subscription.current_period_end
    ? allowanceWindow(new Date(subscription.current_period_start), new Date(subscription.current_period_end))
    : null
  const [{ data: usagePeriod }, { data: creditBalance }] = isPro
    ? await Promise.all([
        allowance
          ? supabase
              .from("ai_usage_periods")
              .select("credits_used, credit_limit")
              .eq("user_id", user.id)
              .eq("period_start", allowance.start.toISOString())
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("ai_credit_balances").select("credits").eq("user_id", user.id).maybeSingle(),
      ])
    : [{ data: null }, { data: null }]

  const preferences = profile?.preferences as UserPreferences | null
  const aiSettings = resolveAiSettings(preferences)
  const canUsePlatformAiKey = profile?.allow_platform_ai_key === true
  const canUseJobclockAi = entitlement.hostedAi
  const savedBillingSource = preferences?.ai_billing_source
  const hasPersonalKey = Boolean(preferences?.anthropic_api_key || preferences?.openai_api_key)
  const aiBillingSource = canUseJobclockAi
    ? savedBillingSource ?? (hasPersonalKey ? "personal" : "jobclock")
    : "personal"

  const anthropicKeySource = preferences?.anthropic_api_key
    ? "saved"
    : canUsePlatformAiKey && process.env.ANTHROPIC_API_KEY ? "env" : "none"
  const openaiKeySource = preferences?.openai_api_key
    ? "saved"
    : canUsePlatformAiKey && process.env.OPENAI_API_KEY ? "env" : "none"
  const perplexityKeySource = preferences?.perplexity_api_key
    ? "saved"
    : canUsePlatformAiKey && process.env.PERPLEXITY_API_KEY ? "env" : "none"

  const jobSources: JobSources = (preferences?.job_sources as JobSources) ?? {}

  const prefs = (profile?.preferences ?? {}) as Record<string, unknown>
  const preferredCvTemplate = (prefs.preferred_cv_template as string) ?? "modern"
  const preferredCoverLetterTemplate = (prefs.preferred_cover_letter_template as string) ?? "classic"

  return (
    <div className="page-shell max-w-4xl gap-6 py-5 md:gap-8 md:py-8 lg:min-h-0 lg:flex-1">
      <div className="page-header gap-3 pb-5 md:pb-6">
        <div className="space-y-3">
          <p className="page-kicker">Settings</p>
          <div className="space-y-2">
            <h1 className="page-title">Configure your assistant.</h1>
            <p className="page-lede max-w-2xl">
              Set up your AI provider, appearance, extension access, job search preferences, and job sources.
            </p>
          </div>
        </div>
      </div>

      <Suspense>
        <SettingsTabs
          aiSettings={aiSettings}
          keyStatus={{ anthropic: anthropicKeySource as "saved" | "env" | "none", openai: openaiKeySource as "saved" | "env" | "none", perplexity: perplexityKeySource as "saved" | "env" | "none" }}
          preferredCvTemplate={preferredCvTemplate}
          preferredCoverLetterTemplate={preferredCoverLetterTemplate}
          jobSources={jobSources}
          extensionToken={extensionToken}
          telegramConnection={telegramConnection}
          telegramBotUsername={process.env.TELEGRAM_BOT_USERNAME ?? null}
          telegramConfigured={Boolean(
            process.env.ENCRYPTION_SECRET &&
            process.env.TELEGRAM_BOT_TOKEN &&
            process.env.TELEGRAM_BOT_USERNAME &&
            process.env.TELEGRAM_WEBHOOK_SECRET
          )}
          profilePrefs={{
            desired_roles: profileData?.desired_roles ?? null,
            locations_uk: profileData?.locations_uk ?? null,
            target_salary_min: profileData?.target_salary_min ? Number(profileData.target_salary_min) : null,
            right_to_work_uk: profileData?.right_to_work_uk ?? null,
            experience_level: profileData?.experience_level ?? null,
          }}
          trackedCompanies={companies}
          billingSummary={{
            plan: isPro ? "pro" : "free",
            status: entitlement.granted ? "lifetime" : subscription?.status ?? null,
            lifetime: entitlement.granted,
            cadence: subscription?.billing_interval === "month" || subscription?.billing_interval === "year"
              ? subscription.billing_interval
              : null,
            periodEnd: subscription?.current_period_end ?? null,
            allowanceResetsAt: allowance?.end.toISOString() ?? null,
            cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
            creditsUsed: Number(usagePeriod?.credits_used ?? 0),
            monthlyCredits: PRO_CREDIT_LIMIT,
            creditLimit: Number(usagePeriod?.credit_limit ?? PRO_CREDIT_LIMIT),
            purchasedCredits: Number(creditBalance?.credits ?? 0),
            creditPacks: Object.entries(CREDIT_PACKS).map(([id, pack]) => ({ id, ...pack })),
          }}
          aiBillingSource={aiBillingSource}
          canUseJobclockAi={canUseJobclockAi}
          hostedProviderPreference={preferences?.hosted_provider_preference ?? "automatic"}
        />
      </Suspense>
    </div>
  )
}
