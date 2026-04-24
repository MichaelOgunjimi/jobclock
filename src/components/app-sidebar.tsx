"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured, SUPABASE_SETUP_MESSAGE } from "@/lib/supabase/config"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  FileText,
  Send,
  LogOut,
  Search,
  Settings,
  UserCircle,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react"
import { toast } from "sonner"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Job Search", icon: Search },
  { href: "/applications", label: "Applications", icon: Send },
  { href: "/profile", label: "My CV", icon: FileText },
]

export function AppSidebar({
  isMobileOpen,
  onMobileOpenChange,
}: {
  isMobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
}) {
  const pathname = usePathname()
  const supabase = isSupabaseConfigured() ? createClient() : null
  const isPreviewPage = pathname.endsWith("/cv") || pathname.endsWith("/cover-letter")
  const [userCollapsed, setUserCollapsed] = useState(false)
  const isCollapsed = isPreviewPage || userCollapsed

  async function handleSignOut() {
    if (!supabase) {
      toast.error(SUPABASE_SETUP_MESSAGE)
      return
    }

    await supabase.auth.signOut()
    window.location.href = "/auth"
  }

  function renderNavContent() {
    return (
      <>
        <div className="flex h-[73px] items-center justify-between gap-3 border-b border-sidebar-border px-5">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-white/10 bg-sidebar-primary text-sidebar-primary-foreground">
              <span className="font-heading text-[24px] font-semibold leading-none">J</span>
            </div>
            <div className={cn("min-w-0 transition-opacity", isCollapsed && "lg:hidden")}>
              <p className="section-label text-white/45">Job Assistant</p>
              <p className="font-heading text-[1.55rem] leading-none text-white">Workspace</p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="hidden border-0 text-sidebar-foreground hover:bg-white/5 hover:text-white lg:inline-flex"
            onClick={() => setUserCollapsed((value) => !value)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="border-0 text-sidebar-foreground hover:bg-white/5 hover:text-white lg:hidden"
            onClick={() => onMobileOpenChange(false)}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-2 px-4 py-6">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                onClick={() => onMobileOpenChange(false)}
                className={cn(
                  "group flex items-center gap-3 border border-transparent px-4 py-3 text-[13px] font-medium tracking-[0.02em] text-sidebar-foreground transition-colors",
                  isActive
                    ? "border-white/10 bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:border-white/10 hover:bg-white/5 hover:text-white",
                  isCollapsed && "lg:mx-auto lg:w-12 lg:justify-center lg:px-0"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={cn("truncate", isCollapsed && "lg:hidden")}>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-5">
          <Link
            href="/account"
            title="Account"
            onClick={() => onMobileOpenChange(false)}
            className={cn(
              "mb-2 flex items-center gap-3 border border-transparent px-4 py-3 text-[13px] font-medium tracking-[0.02em] text-sidebar-foreground transition-colors hover:border-white/10 hover:bg-white/5 hover:text-white",
              pathname.startsWith("/account") && "border-white/10 bg-sidebar-primary text-sidebar-primary-foreground",
              isCollapsed && "lg:mx-auto lg:w-12 lg:justify-center lg:px-0"
            )}
          >
            <UserCircle className="h-4 w-4 shrink-0" />
            <span className={cn(isCollapsed && "lg:hidden")}>Account</span>
          </Link>
          <Link
            href="/settings"
            title="Settings"
            onClick={() => onMobileOpenChange(false)}
            className={cn(
              "mb-2 flex items-center gap-3 border border-transparent px-4 py-3 text-[13px] font-medium tracking-[0.02em] text-sidebar-foreground transition-colors hover:border-white/10 hover:bg-white/5 hover:text-white",
              pathname.startsWith("/settings") && "border-white/10 bg-sidebar-primary text-sidebar-primary-foreground",
              isCollapsed && "lg:mx-auto lg:w-12 lg:justify-center lg:px-0"
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className={cn(isCollapsed && "lg:hidden")}>Settings</span>
          </Link>
          <button
            onClick={handleSignOut}
            className={cn(
              "flex w-full items-center gap-3 border border-transparent px-4 py-3 text-[13px] font-medium tracking-[0.02em] text-sidebar-foreground transition-colors hover:border-white/10 hover:bg-white/5 hover:text-white",
              isCollapsed && "lg:mx-auto lg:w-12 lg:justify-center lg:px-0"
            )}
            title="Sign Out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={cn(isCollapsed && "lg:hidden")}>Sign Out</span>
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden",
          isMobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => onMobileOpenChange(false)}
        aria-hidden="true"
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[292px] flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {renderNavContent()}
      </aside>

      <div
        aria-hidden="true"
        className={cn(
          "hidden h-screen shrink-0 lg:block",
          isCollapsed ? "w-[88px]" : "w-[280px]"
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 hidden flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
          isCollapsed ? "w-[88px]" : "w-[280px]"
        )}
      >
        {renderNavContent()}
      </aside>
    </>
  )
}
