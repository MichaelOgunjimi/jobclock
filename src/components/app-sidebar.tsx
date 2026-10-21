"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Drawer } from "@base-ui/react/drawer"
import { Dialog } from "@base-ui/react/dialog"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  FileText,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Send,
  Settings,
  UserCircle,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured, SUPABASE_SETUP_MESSAGE } from "@/lib/supabase/config"
import { cn } from "@/lib/utils"
import {
  SIDEBAR_COLLAPSED_EVENT,
  SIDEBAR_COLLAPSED_KEY,
} from "@/lib/sidebar-preference"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Job Search", icon: Search },
  { href: "/applications", label: "Applications", icon: Send },
  { href: "/interview", label: "Interview Prep", icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/profile", label: "My CV", icon: FileText },
]

export interface SidebarUserProfile {
  email: string
  fullName: string | null
  avatarUrl: string | null
}

type MobilePanel = "root" | "sign-out"

function getInitials(fullName: string | null, email: string): string {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase()
  }
  return email[0]?.toUpperCase() ?? "U"
}

function isRouteActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href))
}

function subscribeToSidebarPreference(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SIDEBAR_COLLAPSED_KEY) onStoreChange()
  }

  window.addEventListener("storage", handleStorage)
  window.addEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange)
  return () => {
    window.removeEventListener("storage", handleStorage)
    window.removeEventListener(SIDEBAR_COLLAPSED_EVENT, onStoreChange)
  }
}

function getSidebarPreference() {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    if (stored === "true" || stored === "false") return stored === "true"
  } catch {
    // Fall through to the server-provided document state.
  }
  return document.documentElement.dataset.sidebarCollapsed === "true"
}

function applySidebarPreference(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed))
  } catch {
    // The cookie and current page still preserve the preference.
  }
  document.cookie = `${SIDEBAR_COLLAPSED_KEY}=${collapsed}; path=/; max-age=31536000; samesite=lax`
  document.documentElement.dataset.sidebarCollapsed = String(collapsed)
}

function UserIdentity({ userProfile }: { userProfile: SidebarUserProfile }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-sidebar-primary text-[12px] font-semibold uppercase tracking-wide text-white">
        {userProfile.avatarUrl ? (
          <Image
            src={userProfile.avatarUrl}
            alt=""
            width={44}
            height={44}
            className="size-full object-cover"
            unoptimized
          />
        ) : (
          <span>{getInitials(userProfile.fullName, userProfile.email)}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium leading-tight text-white">
          {userProfile.fullName?.trim() || "Your workspace"}
        </p>
        <p className="mt-1 truncate text-[11px] leading-tight text-sidebar-foreground">
          {userProfile.email}
        </p>
      </div>
    </div>
  )
}

function MobileNavigationSheet({
  open,
  onOpenChange,
  pathname,
  userProfile,
  onConfirmSignOut,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pathname: string
  userProfile: SidebarUserProfile
  onConfirmSignOut: () => Promise<void>
}) {
  const [panel, setPanel] = useState<MobilePanel>("root")
  const previousPanelRef = useRef<MobilePanel>("root")
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const signOutButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)")
    const closeAtDesktop = () => {
      if (desktopQuery.matches) onOpenChange(false)
    }

    closeAtDesktop()
    desktopQuery.addEventListener("change", closeAtDesktop)
    return () => desktopQuery.removeEventListener("change", closeAtDesktop)
  }, [onOpenChange])

  useEffect(() => {
    if (previousPanelRef.current === panel) return
    previousPanelRef.current = panel
    if (!open) return

    if (panel === "sign-out") {
      backButtonRef.current?.focus()
    } else {
      signOutButtonRef.current?.focus()
    }
  }, [open, panel])

  function closeSheet() {
    onOpenChange(false)
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) setPanel("root")
      }}
      swipeDirection="down"
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-40 bg-black/55 opacity-100 transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none lg:hidden" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end px-3 lg:hidden">
          <Drawer.Popup className="flex h-[90dvh] max-h-[calc(100dvh-2rem)] w-full translate-y-0 flex-col overflow-hidden border border-b-0 border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[0_-18px_60px_rgba(0,0,0,0.28)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none">
            <Drawer.Title className="sr-only">Navigation</Drawer.Title>
            <Drawer.Description className="sr-only">
              User context, workspace navigation, and account actions.
            </Drawer.Description>

            <div aria-hidden="true" className="mx-auto my-2 h-1 w-10 shrink-0 rounded-full bg-white/20" />

            <div className="min-h-0 flex-1 overflow-hidden">
              <div
                className={cn(
                  "flex h-full w-[200%] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                  panel === "sign-out" && "-translate-x-1/2"
                )}
              >
                <section
                  aria-hidden={panel !== "root"}
                  inert={panel !== "root"}
                  className="flex h-full w-1/2 min-w-0 flex-col"
                >
                  <div className="flex items-center justify-between gap-4 border-b border-sidebar-border px-5 pb-4 pt-2">
                    <UserIdentity userProfile={userProfile} />
                    <Drawer.Close
                      aria-label="Close navigation"
                      className="flex size-9 shrink-0 items-center justify-center border border-white/10 text-sidebar-foreground transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                    >
                      <X className="size-4" />
                    </Drawer.Close>
                  </div>

                  <nav aria-label="Mobile navigation" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <p className="section-label px-4 pb-3 text-white/40">Workspace</p>
                    <div className="grid gap-1.5">
                      {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = isRouteActive(pathname, item.href)
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={closeSheet}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                              "flex min-h-12 items-center gap-3 border border-transparent px-4 py-3 text-[14px] font-medium tracking-[0.01em] transition-[color,background-color,border-color,transform] duration-200 hover:translate-x-0.5 active:translate-y-px motion-reduce:transform-none",
                              isActive
                                ? "border-white/10 bg-sidebar-primary text-white"
                                : "text-sidebar-foreground hover:border-white/10 hover:bg-white/5 hover:text-white"
                            )}
                          >
                            <Icon className="size-4 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </nav>

                  <div className="border-t border-sidebar-border px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
                    <Link
                      href="/account"
                      onClick={closeSheet}
                      aria-current={pathname.startsWith("/account") ? "page" : undefined}
                      className={cn(
                        "flex min-h-12 items-center gap-3 border border-transparent px-4 py-3 text-[14px] font-medium transition-[color,background-color,border-color,transform] duration-200 hover:translate-x-0.5 active:translate-y-px motion-reduce:transform-none",
                        pathname.startsWith("/account")
                          ? "border-white/10 bg-sidebar-primary text-white"
                          : "text-sidebar-foreground hover:border-white/10 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <UserCircle className="size-4 shrink-0" />
                      Account
                    </Link>
                    <Link
                      href="/settings"
                      onClick={closeSheet}
                      aria-current={pathname.startsWith("/settings") ? "page" : undefined}
                      className={cn(
                        "flex min-h-12 items-center gap-3 border border-transparent px-4 py-3 text-[14px] font-medium transition-[color,background-color,border-color,transform] duration-200 hover:translate-x-0.5 active:translate-y-px motion-reduce:transform-none",
                        pathname.startsWith("/settings")
                          ? "border-white/10 bg-sidebar-primary text-white"
                          : "text-sidebar-foreground hover:border-white/10 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <Settings className="size-4 shrink-0" />
                      Settings
                    </Link>
                    <button
                      ref={signOutButtonRef}
                      type="button"
                      onClick={() => setPanel("sign-out")}
                      className="flex min-h-12 w-full items-center gap-3 border border-transparent px-4 py-3 text-[14px] font-medium text-sidebar-foreground transition-[color,background-color,border-color,transform] duration-200 hover:translate-x-0.5 hover:border-white/10 hover:bg-white/5 hover:text-white active:translate-y-px motion-reduce:transform-none"
                    >
                      <LogOut className="size-4 shrink-0" />
                      Sign out
                    </button>
                  </div>
                </section>

                <section
                  aria-hidden={panel !== "sign-out"}
                  inert={panel !== "sign-out"}
                  className="flex h-full w-1/2 min-w-0 flex-col"
                >
                  <div className="flex items-center justify-between border-b border-sidebar-border px-4 pb-4 pt-2">
                    <button
                      ref={backButtonRef}
                      type="button"
                      onClick={() => setPanel("root")}
                      className="flex min-h-9 items-center gap-2 px-1 text-[13px] font-medium text-white transition-colors hover:text-white/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                    >
                      <ArrowLeft className="size-4" />
                      Back
                    </button>
                    <Drawer.Close
                      aria-label="Close navigation"
                      className="flex size-9 items-center justify-center border border-white/10 text-sidebar-foreground transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                    >
                      <X className="size-4" />
                    </Drawer.Close>
                  </div>

                  <div className="flex flex-1 flex-col justify-between px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
                    <div>
                      <p className="section-label text-white/40">Account</p>
                      <h2 className="mt-3 font-heading text-3xl leading-none text-white">Sign out?</h2>
                      <p className="mt-4 max-w-sm text-sm leading-relaxed text-sidebar-foreground">
                        You will be returned to the login page.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        className="w-full"
                        onClick={() => void onConfirmSignOut()}
                      >
                        Sign out
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-white/15 bg-transparent text-white hover:bg-white/5 hover:text-white"
                        onClick={() => setPanel("root")}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

export function AppSidebar({
  initialCollapsed = false,
  isMobileOpen,
  onMobileOpenChange,
  userProfile,
}: {
  initialCollapsed?: boolean
  isMobileOpen: boolean
  onMobileOpenChange: (open: boolean) => void
  userProfile: SidebarUserProfile
}) {
  const pathname = usePathname()
  const supabase = isSupabaseConfigured() ? createClient() : null
  const isPreviewPage = pathname.endsWith("/cv") || pathname.endsWith("/cover-letter")
  const userCollapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarPreference,
    () => initialCollapsed
  )
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const isCollapsed = isPreviewPage || userCollapsed

  useEffect(() => {
    applySidebarPreference(getSidebarPreference())
  }, [])

  function toggleCollapsed() {
    const next = !userCollapsed
    applySidebarPreference(next)
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_EVENT))
  }

  async function confirmSignOut() {
    if (!supabase) {
      toast.error(SUPABASE_SETUP_MESSAGE)
      return
    }
    await supabase.auth.signOut()
    window.location.href = "/auth"
  }

  return (
    <>
      <MobileNavigationSheet
        open={isMobileOpen}
        onOpenChange={onMobileOpenChange}
        pathname={pathname}
        userProfile={userProfile}
        onConfirmSignOut={confirmSignOut}
      />

      <div
        aria-hidden="true"
        className={cn(
          "dashboard-sidebar-spacer hidden h-[100dvh] shrink-0 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none lg:block",
          isCollapsed ? "w-[88px]" : "w-[280px]"
        )}
      />

      <aside
        aria-label="Primary navigation"
        data-collapsed={isCollapsed ? "" : undefined}
        className={cn(
          "dashboard-sidebar fixed inset-y-0 left-0 z-20 hidden flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none lg:flex",
          isCollapsed ? "w-[88px]" : "w-[280px]"
        )}
      >
        <div
          className={cn(
            "dashboard-sidebar-header flex h-[73px] items-center justify-between gap-3 border-b border-sidebar-border px-5 transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            isCollapsed && "lg:justify-center lg:px-2"
          )}
        >
          <div
            className={cn(
              "dashboard-sidebar-brand flex max-w-[200px] items-center gap-3 overflow-hidden opacity-100 transition-[max-width,opacity,transform] duration-200 ease-out motion-reduce:transition-none",
              isCollapsed && "lg:pointer-events-none lg:max-w-0 lg:-translate-x-2 lg:opacity-0"
            )}
          >
            <div className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-white/10 bg-sidebar-primary">
              <Image
                src="/logo-mark-light-white.svg"
                alt="Jobclock"
                width={40}
                height={40}
                priority
                unoptimized
                className="size-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className="section-label text-white/45">Job Assistant</p>
              <p className="font-heading text-[1.55rem] leading-none text-white">Workspace</p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="dashboard-sidebar-toggle hidden shrink-0 border-0 text-sidebar-foreground transition-[color,background-color,transform] duration-200 hover:bg-white/5 hover:text-white active:scale-90 motion-reduce:transform-none lg:inline-flex"
            onClick={toggleCollapsed}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="relative size-4" aria-hidden="true">
              <PanelLeftClose
                className={cn(
                  "absolute inset-0 size-4 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
                  isCollapsed ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"
                )}
              />
              <PanelLeftOpen
                className={cn(
                  "absolute inset-0 size-4 transition-[opacity,transform] duration-200 motion-reduce:transition-none",
                  isCollapsed ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"
                )}
              />
            </span>
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-2 px-4 py-6">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = isRouteActive(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "dashboard-sidebar-link group flex items-center gap-3 border border-transparent px-4 py-3 text-[13px] font-medium tracking-[0.02em] text-sidebar-foreground transition-[color,background-color,border-color,transform,width,padding,margin] duration-200 motion-reduce:transition-none",
                  isActive
                    ? "border-white/10 bg-sidebar-primary text-sidebar-primary-foreground"
                    : "hover:border-white/10 hover:bg-white/5 hover:text-white",
                  isCollapsed && "lg:mx-auto lg:w-12 lg:justify-center lg:px-0"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span
                  className={cn(
                    "dashboard-sidebar-copy max-w-[180px] overflow-hidden truncate opacity-100 transition-[max-width,opacity,transform] duration-200 ease-out motion-reduce:transition-none",
                    isCollapsed && "lg:max-w-0 lg:-translate-x-2 lg:opacity-0"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-5">
          <Link
            href="/account"
            title="Account"
            aria-current={pathname.startsWith("/account") ? "page" : undefined}
            className={cn(
              "dashboard-sidebar-link mb-2 flex items-center gap-3 border border-transparent px-4 py-3 text-[13px] font-medium tracking-[0.02em] text-sidebar-foreground transition-[color,background-color,border-color,transform,width,padding,margin] duration-200 hover:border-white/10 hover:bg-white/5 hover:text-white motion-reduce:transition-none",
              pathname.startsWith("/account") && "border-white/10 bg-sidebar-primary text-sidebar-primary-foreground",
              isCollapsed && "lg:mx-auto lg:w-12 lg:justify-center lg:px-0"
            )}
          >
            <UserCircle className="size-4 shrink-0" />
            <span
              className={cn(
                "dashboard-sidebar-copy max-w-[180px] overflow-hidden opacity-100 transition-[max-width,opacity,transform] duration-200 ease-out motion-reduce:transition-none",
                isCollapsed && "lg:max-w-0 lg:-translate-x-2 lg:opacity-0"
              )}
            >
              Account
            </span>
          </Link>
          <Link
            href="/settings"
            title="Settings"
            aria-current={pathname.startsWith("/settings") ? "page" : undefined}
            className={cn(
              "dashboard-sidebar-link mb-2 flex items-center gap-3 border border-transparent px-4 py-3 text-[13px] font-medium tracking-[0.02em] text-sidebar-foreground transition-[color,background-color,border-color,transform,width,padding,margin] duration-200 hover:border-white/10 hover:bg-white/5 hover:text-white motion-reduce:transition-none",
              pathname.startsWith("/settings") && "border-white/10 bg-sidebar-primary text-sidebar-primary-foreground",
              isCollapsed && "lg:mx-auto lg:w-12 lg:justify-center lg:px-0"
            )}
          >
            <Settings className="size-4 shrink-0" />
            <span
              className={cn(
                "dashboard-sidebar-copy max-w-[180px] overflow-hidden opacity-100 transition-[max-width,opacity,transform] duration-200 ease-out motion-reduce:transition-none",
                isCollapsed && "lg:max-w-0 lg:-translate-x-2 lg:opacity-0"
              )}
            >
              Settings
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setShowLogoutDialog(true)}
            className={cn(
              "dashboard-sidebar-link flex w-full items-center gap-3 border border-transparent px-4 py-3 text-[13px] font-medium tracking-[0.02em] text-sidebar-foreground transition-[color,background-color,border-color,transform,width,padding,margin] duration-200 hover:border-white/10 hover:bg-white/5 hover:text-white motion-reduce:transition-none",
              isCollapsed && "lg:mx-auto lg:w-12 lg:justify-center lg:px-0"
            )}
            title="Sign Out"
          >
            <LogOut className="size-4 shrink-0" />
            <span
              className={cn(
                "dashboard-sidebar-copy max-w-[180px] overflow-hidden opacity-100 transition-[max-width,opacity,transform] duration-200 ease-out motion-reduce:transition-none",
                isCollapsed && "lg:max-w-0 lg:-translate-x-2 lg:opacity-0"
              )}
            >
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      <Dialog.Root open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 hidden bg-black/50 opacity-100 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none lg:block" />
          <Dialog.Viewport className="fixed inset-0 z-50 hidden items-center justify-center p-4 lg:flex">
            <Dialog.Popup className="w-full max-w-sm translate-y-0 scale-100 border border-border bg-background opacity-100 shadow-lg transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-[ending-style]:translate-y-2 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:translate-y-2 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 motion-reduce:transition-none">
              <div className="px-5 py-4">
                <Dialog.Title className="text-sm font-medium">Sign out?</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                  You will be returned to the login page.
                </Dialog.Description>
              </div>
              <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
                <Dialog.Close render={<Button variant="outline" size="sm" />}>Cancel</Dialog.Close>
                <Button variant="destructive" size="sm" onClick={() => void confirmSignOut()}>
                  Sign out
                </Button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
