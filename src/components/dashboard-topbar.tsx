"use client"

import Image from "next/image"
import { useRef, useState, useCallback, useTransition } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, ChevronRight, LogOut, PanelLeftOpen, Settings, UserCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { useDismissibleLayer } from "@/hooks/use-dismissible-layer"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { useGenerationJobsContext } from "@/contexts/generation-jobs-context"
import { markJobsSeen } from "@/app/(dashboard)/generation-actions"
import { formatRelativeTime } from "@/lib/relative-time"
import type { GenerationKind, GenerationStatus } from "@/lib/generation/jobs"

function kindLabel(kind: GenerationKind): string {
  switch (kind) {
    case "cover_letter": return "Cover letter"
    case "company_research": return "Company research"
    case "interview_prep": return "Interview prep"
    case "cv_tailor": return "Tailored CV"
    case "interview_answer": return "Interview answer"
  }
}

function jobHref(
  kind: GenerationKind,
  applicationId: string | null,
  status: GenerationStatus,
): string {
  if (!applicationId) return "/applications"
  const base = `/applications/${applicationId}`
  switch (kind) {
    // Deep-link to the generated artifact on success. A failed cv_tailor /
    // cover_letter has no row, so its preview page would notFound() — send
    // those back to the application page to retry instead.
    case "cv_tailor":
      return status === "done" ? `${base}/cv` : base
    case "cover_letter":
      return status === "done" ? `${base}/cover-letter` : base
    case "interview_prep":
    case "interview_answer":
      return `/interview?applicationId=${applicationId}`
    case "company_research":
      return base
  }
}

function NotificationsDropdown() {
  const { recentJobs, unseenJobs, unseenCount, getApplicationLabel } =
    useGenerationJobsContext()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useDismissibleLayer({
    enabled: open,
    onDismiss: () => setOpen(false),
    refs: [triggerRef, panelRef],
  })

  function handleOpen() {
    setOpen((v) => !v)
    if (unseenJobs.length > 0) {
      startTransition(() => {
        void markJobsSeen(unseenJobs.map((j) => j.id))
      })
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={handleOpen}
        className="relative flex h-8 w-8 shrink-0 items-center justify-center border bg-secondary text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
      >
        <Bell className="h-3.5 w-3.5" />
        {unseenCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center bg-foreground text-[9px] font-bold text-background">
            {unseenCount > 9 ? "9+" : unseenCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-80 border bg-card shadow-lg"
        >
          <div className="border-b px-4 py-3">
            <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Generations
            </p>
          </div>
          {recentJobs.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto py-1">
              {recentJobs.map((job) => {
                const label = getApplicationLabel(job.application_id)
                const title = label
                  ? `${kindLabel(job.kind)} · ${label.role} at ${label.company}`
                  : kindLabel(job.kind)
                return (
                  <Link
                    key={job.id}
                    href={jobHref(job.kind, job.application_id, job.status)}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-4 py-3 text-[13px] transition-colors hover:bg-muted"
                  >
                    <span
                      className={
                        job.status === "done"
                          ? "mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground"
                          : "mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive"
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{title}</p>
                      <p className="mt-0.5 flex items-center justify-between gap-2 text-muted-foreground">
                        <span className="min-w-0 truncate">
                          {job.status === "done" ? "Ready" : job.error ?? "Failed"}
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums">
                          {formatRelativeTime(job.updated_at)}
                        </span>
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useDismissibleLayer({
    enabled: open,
    onDismiss: () => setOpen(false),
    refs: [triggerRef, panelRef],
  })

  const scheduleClose = useCallback(() => {
    closeTimeout.current = setTimeout(() => setOpen(false), 150)
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimeout.current) clearTimeout(closeTimeout.current)
  }, [])

  const initials = getInitials(userProfile.fullName, userProfile.email)

  async function confirmSignOut() {
    if (!isSupabaseConfigured()) return
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/auth"
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => { cancelClose(); setOpen(true) }}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label="Open account menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden border bg-secondary text-[11px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
      >
        {userProfile.avatarUrl ? (
          <Image src={userProfile.avatarUrl} alt="" width={32} height={32} className="h-full w-full object-cover" unoptimized />
        ) : (
          <span>{initials}</span>
        )}
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
                {userProfile.avatarUrl ? (
                  <Image src={userProfile.avatarUrl} alt="" width={40} height={40} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <span>{initials}</span>
                )}
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
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-muted"
            >
              <UserCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              Account
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-muted"
            >
              <Settings className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              Settings
            </Link>
          </div>

          {/* Sign out */}
          <div className="border-t py-1">
            <button
              type="button"
              onClick={() => { setOpen(false); setShowLogoutDialog(true) }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-foreground transition-colors hover:bg-muted"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {showLogoutDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm border border-border bg-background shadow-lg">
            <div className="px-5 py-4">
              <h2 className="text-sm font-medium">Sign out?</h2>
              <p className="mt-1 text-xs text-muted-foreground">You will be returned to the login page.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <Button variant="outline" size="sm" onClick={() => setShowLogoutDialog(false)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={confirmSignOut}>Sign out</Button>
            </div>
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
      <div className="flex h-16 w-full items-center justify-between gap-3 px-4 sm:h-[73px] sm:px-6 md:px-8">
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
          <NotificationsDropdown />
          <AvatarDropdown userProfile={userProfile} />
        </div>
      </div>
    </div>
  )
}
