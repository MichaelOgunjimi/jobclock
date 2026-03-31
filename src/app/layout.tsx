import type { Metadata } from "next"
import { cookies } from "next/headers"
import { Geist_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"

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

export const metadata: Metadata = {
  title: {
    default: "Jobclock",
    template: "%s | Jobclock",
  },
  description: "AI-powered job search assistant for UK roles",
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
      <body className={`${uiSans.variable} ${uiSerif.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider initialTheme={initialTheme}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
