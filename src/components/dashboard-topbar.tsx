"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, PanelLeftOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"

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

  const initials = getInitials(userProfile.fullName, userProfile.email)
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
          <Link
            href="/account"
            aria-label="Account"
            title={userProfile.fullName ?? userProfile.email}
            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden border bg-secondary text-[11px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-foreground/40"
          >
            {userProfile.avatarUrl ? (
              <img
                src={userProfile.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initials
            )}
          </Link>
        </div>
      </div>
    </div>
  )
}
