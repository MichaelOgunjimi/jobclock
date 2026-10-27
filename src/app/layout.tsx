import type { Metadata } from "next"
import { Geist_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google"
import { Suspense } from "react"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { NavigationScrollRestoration } from "@/components/navigation-scroll-restoration"
import { Analytics } from "@vercel/analytics/next"
import { SIDEBAR_PREFERENCE_SCRIPT } from "@/lib/sidebar-preference"
import { getAppUrl, isProductionSite } from "@/lib/site"

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
// reject it. NEXT_PUBLIC_APP_URL sets the canonical host per environment.
const siteUrl = getAppUrl()

const siteName = "Jobclock"
const siteDescription =
  "AI-powered job search assistant for UK roles. Save jobs from any site, tailor your CV per role, draft cover letters, and prep for interviews — all in one workspace."

const themeScript = `(function(){try{var t=localStorage.getItem("job-assistant-theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var d=document.documentElement;d.classList.toggle("dark",t==="dark");d.dataset.theme=t}catch(e){}})()`

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  robots: isProductionSite() ? undefined : { index: false, follow: false },
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_PREFERENCE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${uiSans.variable} ${uiSerif.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider initialTheme="light">
          <Suspense fallback={null}>
            <NavigationScrollRestoration />
          </Suspense>
          {children}
          <Toaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
