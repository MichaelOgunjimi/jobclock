/** Hosts the Chrome extension is allowed to talk to. Must match extension/manifest.json host_permissions. */
export const EXTENSION_HOSTS = ["jobclock.dev"] as const

/** Where users reach us. Cloudflare Email Routing forwards it; replies go out through Resend. */
export const SUPPORT_EMAIL = "support@jobclock.dev"

/**
 * The public origin of this deployment, e.g. https://jobclock.dev, without a trailing slash.
 * NEXT_PUBLIC_APP_URL must be set in every deployed environment; only development and tests
 * fall back to localhost, so a missing value fails loudly instead of leaking another host.
 */
export function getAppUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL
  if (value) return value.replace(/\/+$/, "")
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000"
  throw new Error("NEXT_PUBLIC_APP_URL is not configured")
}

export function getSiteHost(): string {
  return new URL(getAppUrl()).host
}

/**
 * True only for the real production site. Staging runs as the "production" target of its own
 * Vercel project, so APP_ENV decides first and VERCEL_ENV is only the fallback.
 */
export function isProductionSite(): boolean {
  return (process.env.APP_ENV || (process.env.VERCEL_ENV === "production" ? "production" : undefined)) === "production"
}
