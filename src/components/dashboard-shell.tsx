"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardTopbar } from "@/components/dashboard-topbar"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background lg:fixed lg:inset-0 lg:min-h-0 lg:overflow-hidden">
      <AppSidebar
        isMobileOpen={isMobileSidebarOpen}
        onMobileOpenChange={setIsMobileSidebarOpen}
      />
      <main className="min-w-0 flex-1 overflow-x-hidden pt-16 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pt-0">
        <DashboardTopbar onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)} />
        {children}
      </main>
    </div>
  )
}
