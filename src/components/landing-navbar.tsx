"use client"

import Link from "next/link"
import { ArrowRight, Menu, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useDismissibleLayer } from "@/hooks/use-dismissible-layer"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { buttonVariants } from "@/components/ui/button-styles"
import { LandingAnchorLink } from "@/components/landing-anchor-link"
import { cn } from "@/lib/utils"

const sections = [
  { id: "features", label: "Features" },
  { id: "workflow", label: "Workflow" },
  { id: "start", label: "Start" },
]

interface UserProfile {
  email: string
  fullName: string | null
  avatarUrl: string | null
}

function getInitials(fullName: string | null, email: string): string {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase()
  }
  return email[0].toUpperCase()
}

export function LandingNavbar({ userProfile }: { userProfile: UserProfile | null }) {
  const [activeSection, setActiveSection] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "features"
    }

    return window.location.hash.slice(1) || "features"
  })
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const sectionElements = sections
      .map((section) => document.getElementById(section.id))
      .filter((section): section is HTMLElement => section instanceof HTMLElement)

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (visible?.target instanceof HTMLElement) {
          setActiveSection(visible.target.id)
        }
      },
      {
        rootMargin: "-30% 0px -50% 0px",
        threshold: [0.2, 0.35, 0.5, 0.7],
      }
    )

    sectionElements.forEach((section) => observer.observe(section))

    function handleHashChange() {
      setActiveSection(window.location.hash.slice(1))
    }

    window.addEventListener("hashchange", handleHashChange)

    return () => {
      observer.disconnect()
      window.removeEventListener("hashchange", handleHashChange)
    }
  }, [])

  useDismissibleLayer({
    enabled: isMobileMenuOpen,
    onDismiss: () => setIsMobileMenuOpen(false),
    refs: [mobileMenuRef, mobileMenuButtonRef],
  })

  useEffect(() => {
    function handleResize() {
      if (window.matchMedia("(min-width: 768px)").matches) {
        setIsMobileMenuOpen(false)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-3 sm:px-6 md:px-10 xl:px-12">
        <div className="border bg-background/94 shadow-[0_18px_48px_rgba(0,0,0,0.06)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 border-b px-4 py-4 md:grid md:grid-cols-[auto_1fr_auto] md:px-6">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center border bg-primary text-primary-foreground">
                <span className="text-[24px] font-semibold leading-none">J</span>
              </div>
              <div className="min-w-0">
                <p className="page-kicker">Job Assistant</p>
                <p className="truncate text-sm text-muted-foreground">Editorial career workflow</p>
              </div>
            </Link>

            <nav className="hidden items-center justify-center md:flex">
              <div className="flex items-center border-l">
                {sections.map((section) => {
                  const isActive = activeSection === section.id

                  return (
                    <LandingAnchorLink
                      key={section.id}
                      href={`#${section.id}`}
                      className={cn(
                        "border-r px-5 py-4 text-sm tracking-[0.02em] transition-colors",
                        isActive
                          ? "bg-secondary text-foreground shadow-[inset_0_-2px_0_0_var(--color-foreground)]"
                          : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                      )}
                    >
                      {section.label}
                    </LandingAnchorLink>
                  )
                })}
              </div>
            </nav>

            <div className="flex items-center gap-2 justify-self-end">
              <ThemeToggle />
              {userProfile ? (
                <>
                  <Link
                    href="/jobs"
                    className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}
                  >
                    Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/account"
                    aria-label="Account"
                    title={userProfile.fullName ?? userProfile.email}
                    className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden border bg-secondary text-[11px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-foreground/40"
                  >
                    {userProfile.avatarUrl ? (
                      <img src={userProfile.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      getInitials(userProfile.fullName, userProfile.email)
                    )}
                  </Link>
                </>
              ) : (
                <>
                  <Button
                    ref={mobileMenuButtonRef}
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="md:hidden"
                    aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                    onClick={() => setIsMobileMenuOpen((open) => !open)}
                  >
                    {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                  </Button>
                  <Link
                    href="/auth"
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
                  >
                    Sign in
                  </Link>
                  <Link href="/auth" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
                    <span className="hidden sm:inline">Open workspace</span>
                    <span className="sm:hidden">Open</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </>
              )}
            </div>
          </div>

          {isMobileMenuOpen && !userProfile && (
            <div ref={mobileMenuRef} className="border-b md:hidden">
              <nav className="grid gap-px bg-border">
                {sections.map((section) => {
                  const isActive = activeSection === section.id

                  return (
                    <LandingAnchorLink
                      key={section.id}
                      href={`#${section.id}`}
                      onNavigate={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "bg-background px-4 py-3 text-sm transition-colors",
                        isActive
                          ? "text-foreground shadow-[inset_3px_0_0_0_var(--color-foreground)]"
                          : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                      )}
                    >
                      {section.label}
                    </LandingAnchorLink>
                  )
                })}
              </nav>

              <div className="flex flex-col gap-2 border-t px-4 py-4">
                <Link
                  href="/auth"
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full justify-center")}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  href="/auth"
                  className={cn(buttonVariants({ size: "sm" }), "w-full justify-center")}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Open workspace
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
