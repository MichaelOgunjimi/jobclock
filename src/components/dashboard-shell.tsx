"use client"

import Link from "next/link"
import { useState } from "react"
import { KeyRound } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardTopbar } from "@/components/dashboard-topbar"
import { ExtensionAvailabilityBanner } from "@/components/extension-availability-banner"
import { buttonVariants } from "@/components/ui/button-styles"
import { cn } from "@/lib/utils"

interface UserProfile {
  email: string
  fullName: string | null
  avatarUrl: string | null
}

export function DashboardShell({
  children,
  aiKeyBanner,
  showExtensionBanner,
  userProfile,
}: {
  children: React.ReactNode
  aiKeyBanner?: { providerLabel: string } | null
  showExtensionBanner: boolean
  userProfile: UserProfile
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background lg:fixed lg:inset-0 lg:min-h-0 lg:overflow-hidden">
      <AppSidebar
        isMobileOpen={isMobileSidebarOpen}
        onMobileOpenChange={setIsMobileSidebarOpen}
      />
      <main
        data-scroll-restoration-target
        className="min-w-0 flex-1 overflow-x-hidden lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden"
      >
        <DashboardTopbar
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          userProfile={userProfile}
        />
        {aiKeyBanner && (
          <div className="border-b bg-secondary/45 px-4 py-3 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1440px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center border bg-background">
                  <KeyRound className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    Configure a {aiKeyBanner.providerLabel} API key to enable AI generation.
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Add your own provider key in Settings before using CV, cover letter, research, or interview generation.
                  </p>
                </div>
              </div>
              <Link
                href="/settings?tab=ai"
                className={cn(buttonVariants({ size: "sm", variant: "outline" }), "bg-background")}
              >
                Configure AI key
              </Link>
            </div>
          </div>
        )}
        {showExtensionBanner && (
          <div className="border-b px-4 py-3 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1440px]">
              <ExtensionAvailabilityBanner compact />
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
