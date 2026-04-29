"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ApplicationStatus } from "@/lib/supabase/database.types"

const SORT_OPTIONS = [
  { value: "saved_desc", label: "Newest saved" },
  { value: "saved_asc", label: "Oldest saved" },
  { value: "applied_desc", label: "Recently applied" },
  { value: "company_asc", label: "Company A–Z" },
] as const

const STATUS_PILLS: { value: ApplicationStatus | "all"; label: string; dot: string }[] = [
  { value: "all", label: "All", dot: "bg-foreground/40" },
  { value: "saved", label: "Saved", dot: "bg-foreground/55" },
  { value: "applied", label: "Applied", dot: "bg-sky-500" },
  { value: "screening", label: "Screening", dot: "bg-amber-500" },
  { value: "interview", label: "Interview", dot: "bg-violet-500" },
  { value: "offer", label: "Offer", dot: "bg-emerald-500" },
  { value: "rejected", label: "Rejected", dot: "bg-rose-500" },
  { value: "withdrawn", label: "Withdrawn", dot: "bg-muted-foreground/70" },
]

interface Props {
  counts: Record<string, number>
  total: number
  activeStatus: string
  activeSort: string
  activeSearch: string
}

export function ApplicationsFilterBar({ counts, total, activeStatus, activeSort, activeSearch }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchInput, setSearchInput] = useState(activeSearch)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync if the URL param changes externally (e.g. browser back)
  useEffect(() => { setSearchInput(activeSearch) }, [activeSearch])

  // Clear pending debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      router.push(buildUrl({ q: value.trim() || null, page: null }))
    }, 350)
  }

  function buildUrl(overrides: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null || value === "") {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    const qs = params.toString()
    return qs ? `/applications?${qs}` : "/applications"
  }

  function handleSortChange(e: ChangeEvent<HTMLSelectElement>) {
    router.push(buildUrl({ sort: e.target.value === "saved_desc" ? null : e.target.value }))
  }

  return (
    <div className="flex flex-col gap-3 border border-border bg-secondary/35 px-5 py-4">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          aria-label="Search applications by role or company"
          placeholder="Search by role or company…"
          value={searchInput}
          onChange={handleSearchChange}
          className="w-full border border-border bg-background py-2 pl-9 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
        />
      </div>

      {/* Status pills + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status pills */}
        <div className="flex flex-wrap gap-2">
          {STATUS_PILLS.map((pill) => {
            const count = pill.value === "all" ? total : (counts[pill.value] ?? 0)
            const isActive = activeStatus === pill.value || (pill.value === "all" && activeStatus === "all")
            return (
              <a
                key={pill.value}
                href={buildUrl({ status: pill.value === "all" ? null : pill.value })}
                className={cn(
                  "inline-flex items-center gap-1.5 border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.10em] transition-colors",
                  isActive
                    ? "border-foreground/30 bg-foreground/8 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                )}
              >
                <span className={cn("size-1.5 rounded-full", pill.dot)} />
                {pill.label}
                <span className={cn("ml-0.5 tabular-nums", isActive ? "text-foreground/70" : "text-muted-foreground/70")}>
                  {count}
                </span>
              </a>
            )
          })}
        </div>

        {/* Sort dropdown */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">Sort</span>
          <select
            value={activeSort}
            onChange={handleSortChange}
            className="border border-border bg-background px-3 py-1.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
