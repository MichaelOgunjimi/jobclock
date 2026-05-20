import type { MetadataRoute } from "next"

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://jobclock.michaelogunjimi.com"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        // Everything below requires login or is utility-only; keep it out
        // of crawlers regardless of the per-page `robots` metadata.
        disallow: [
          "/auth/",
          "/account",
          "/analytics",
          "/applications",
          "/dashboard",
          "/interview",
          "/jobs",
          "/profile",
          "/settings",
          "/api/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
