import type { Metadata } from "next"
import { cookies } from "next/headers"
import { Geist_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { Analytics } from "@vercel/analytics/next"

const uiSans = IBM_Plex_Sans({
  variable: "--font-ui-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const uiSerif = IBM_Plex_Serif({
  variable: "--font-ui-serif",
  subsets: ["latin"],
  weight: ["400", "500"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

// Crawlers/preview tools need absolute URLs for og:image; without
// metadataBase Next emits the OG image path relative and most validators
// reject it. NEXT_PUBLIC_APP_URL lets staging deploys override the
// canonical host (e.g. preview branches).
const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://jobclock.michaelogunjimi.com"

const siteName = "Jobclock"
const siteDescription =
  "AI-powered job search assistant for UK roles. Save jobs from any site, tailor your CV per role, draft cover letters, and prep for interviews — all in one workspace."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  applicationName: siteName,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName,
    title: siteName,
    description: siteDescription,
    url: siteUrl,
    locale: "en_GB",
    // src/app/opengraph-image.jpg is picked up by file convention too, but
    // listing it here is what makes og:title / og:description co-emit
    // reliably across all crawlers.
    images: [
      {
        url: "/opengraph-image.jpg",
        width: 1200,
        height: 630,
        alt: `${siteName} — a deliberate job search system`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: ["/opengraph-image.jpg"],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const cookieTheme = cookieStore.get("job-assistant-theme")?.value
  const initialTheme = cookieTheme === "dark" ? "dark" : "light"

  return (
    <html
      lang="en"
      className={initialTheme === "dark" ? "dark" : undefined}
      data-theme={initialTheme}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body
        className={`${uiSans.variable} ${uiSerif.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider initialTheme={initialTheme}>
          {children}
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
