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
  banners,
  children,
  initialSidebarCollapsed = false,
  userProfile,
}: {
  banners?: React.ReactNode
  children: React.ReactNode
  initialSidebarCollapsed?: boolean
  userProfile: UserProfile
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        initialCollapsed={initialSidebarCollapsed}
        isMobileOpen={isMobileSidebarOpen}
        onMobileOpenChange={setIsMobileSidebarOpen}
        userProfile={userProfile}
      />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <DashboardTopbar
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          userProfile={userProfile}
        />
        {banners}
        {children}
      </main>
    </div>
  )
}
