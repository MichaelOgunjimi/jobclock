import type { MetadataRoute } from "next"
import { getAppUrl, isProductionSite } from "@/lib/site"

const siteUrl = getAppUrl()

export default function robots(): MetadataRoute.Robots {
  // Only the real production site is indexed; staging and previews stay out of search results.
  if (!isProductionSite()) return { rules: [{ userAgent: "*", disallow: "/" }] }

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
