"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

const LABELS: Record<string, string> = {
  jobs: "Job Search",
  applications: "Applications",
  profile: "My CV",
  settings: "Settings",
}

function toLabel(segment: string) {
  return LABELS[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

export function DashboardTopbar() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)
  const crumbs = [{ href: "/", label: "Dashboard" }, ...segments.map((segment, index) => ({
    href: `/${segments.slice(0, index + 1).join("/")}`,
    label: toLabel(segment),
  }))]

  return (
    <div className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-[73px] w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 md:px-10 xl:px-12">
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-2 overflow-x-auto text-[12px] text-muted-foreground">
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
        </nav>
        <ThemeToggle />
      </div>
    </div>
  )
}
