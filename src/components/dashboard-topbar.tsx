"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, LogOut, PanelLeftOpen, Settings, UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { useDismissibleLayer } from "@/hooks/use-dismissible-layer"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  jobs: "Job Search",
  applications: "Applications",
  profile: "My CV",
  settings: "Settings",
  account: "Account",
}

function toLabel(segment: string) {
  return LABELS[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function getInitials(fullName: string | null, email: string): string {
  if (fullName && fullName.trim()) {
    const parts = fullName.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase()
  }
  return email[0].toUpperCase()
}

interface UserProfile {
  email: string
  fullName: string | null
  avatarUrl: string | null
}

function AvatarDropdown({ userProfile }: { userProfile: UserProfile }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useDismissibleLayer({
    enabled: open,
    onDismiss: () => setOpen(false),
    refs: [triggerRef, panelRef],
  })

  const initials = getInitials(userProfile.fullName, userProfile.email)

  async function handleSignOut() {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/auth"
  }

  const avatarEl = userProfile.avatarUrl ? (
    <img src={userProfile.avatarUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    <span>{initials}</span>
  )

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open account menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden border bg-secondary text-[11px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
      >
        {avatarEl}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-60 border bg-card shadow-lg"
        >
          {/* User identity */}
          <div className="border-b px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border bg-secondary text-[13px] font-semibold uppercase tracking-wide text-foreground">
                {avatarEl}
              </div>
              <div className="min-w-0">
                {userProfile.fullName && (
                  <p className="truncate text-[13px] font-medium leading-tight text-foreground">
                    {userProfile.fullName}
                  </p>
                )}
                <p className="section-label truncate leading-tight text-muted-foreground">
                  {userProfile.email}
                </p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <div className="py-1">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-accent"
            >
              <UserCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              Account
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-accent"
            >
              <Settings className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              Settings
            </Link>
          </div>

          {/* Sign out */}
          <div className="border-t py-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-accent"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function DashboardTopbar({
  onOpenMobileSidebar,
  userProfile,
}: {
  onOpenMobileSidebar: () => void
  userProfile: UserProfile
}) {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const pageCrumbs = segments.map((segment, index) => ({
    href: `/${segments.slice(0, index + 1).join("/")}`,
    label: toLabel(segment),
  }))
  const crumbs =
    pageCrumbs[0]?.href === "/dashboard"
      ? pageCrumbs
      : [{ href: "/dashboard", label: "Dashboard" }, ...pageCrumbs]

  const mobileCrumb = crumbs[crumbs.length - 1] ?? { href: pathname, label: "Dashboard" }

  return (
    <div className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between gap-3 px-4 sm:h-[73px] sm:px-6 md:px-10 xl:px-12">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="shrink-0 lg:hidden"
            onClick={onOpenMobileSidebar}
            aria-label="Open navigation"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="hidden min-w-0 items-center gap-2 overflow-x-auto text-[12px] text-muted-foreground sm:flex">
              {crumbs.map((crumb, index) => {
                const isLast = index === crumbs.length - 1
                return (
                  <li key={crumb.href} className="flex items-center gap-2 whitespace-nowrap">
                    {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    {isLast ? (
                      <span className="font-medium text-foreground">{crumb.label}</span>
                    ) : (
                      <Link href={crumb.href} className="transition-colors hover:text-foreground">
                        {crumb.label}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ol>
            <div className="sm:hidden">
              <span className="text-[13px] font-medium tracking-[0.01em] text-foreground">
                {mobileCrumb.label}
              </span>
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <AvatarDropdown userProfile={userProfile} />
        </div>
      </div>
    </div>
  )
}
