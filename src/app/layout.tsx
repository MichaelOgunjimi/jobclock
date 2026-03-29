import type { Metadata } from "next"
import { cookies } from "next/headers"
import { Geist_Mono, IBM_Plex_Sans } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"

const uiSans = IBM_Plex_Sans({
  variable: "--font-ui-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Job Assistant",
  description: "AI-powered job application assistant for UK graduate roles",
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
      <body className={`${uiSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <ThemeProvider initialTheme={initialTheme}>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
