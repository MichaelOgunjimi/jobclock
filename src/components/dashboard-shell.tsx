"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardTopbar } from "@/components/dashboard-topbar"

interface UserProfile {
  email: string
  fullName: string | null
  avatarUrl: string | null
}

export function DashboardShell({
  children,
  userProfile,
}: {
  children: React.ReactNode
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
        {children}
      </main>
    </div>
  )
}
