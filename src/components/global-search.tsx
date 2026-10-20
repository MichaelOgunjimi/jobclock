"use client"

import { Dialog } from "@base-ui/react/dialog"
import {
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  Compass,
  FileText,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useGenerationJobsContext } from "@/contexts/generation-jobs-context"
import {
  addRecentGlobalSearch,
  globalSearchRecentsKey,
  parseRecentGlobalSearches,
  rankGlobalSearchItems,
  type GlobalSearchItem,
  type GlobalSearchItemType,
} from "@/lib/global-search"
import { cn } from "@/lib/utils"

const NAVIGATION_ITEMS: GlobalSearchItem[] = [
  { id: "nav:dashboard", type: "navigation", label: "Dashboard", description: "Workspace overview", href: "/dashboard", keywords: ["home"] },
  { id: "nav:jobs", type: "navigation", label: "Job Search", description: "Browse open roles", href: "/jobs", keywords: ["roles", "vacancies"] },
  { id: "nav:applications", type: "navigation", label: "Applications", description: "Review your pipeline", href: "/applications", keywords: ["saved", "jobs"] },
  { id: "nav:interview", type: "navigation", label: "Interview Prep", description: "Practise answers and stories", href: "/interview", keywords: ["practice", "questions"] },
  { id: "nav:analytics", type: "navigation", label: "Analytics", description: "Inspect pipeline performance", href: "/analytics", keywords: ["reports", "metrics"] },
  { id: "nav:profile", type: "navigation", label: "My CV", description: "Manage CVs and writing styles", href: "/profile", keywords: ["resume", "profile"] },
  { id: "nav:settings", type: "navigation", label: "Settings", description: "Configure your assistant", href: "/settings", keywords: ["preferences"] },
  { id: "nav:account", type: "navigation", label: "Account", description: "Update your personal details", href: "/account", keywords: ["profile"] },
]

const ACTION_ITEMS: GlobalSearchItem[] = [
  { id: "action:find-role", type: "action", label: "Find a new role", description: "Open job search with your saved preferences", href: "/jobs", keywords: ["search", "browse", "vacancy"] },
  { id: "action:review-pipeline", type: "action", label: "Review application pipeline", description: "Open all tracked applications", href: "/applications", keywords: ["status", "saved"] },
  { id: "action:interview", type: "action", label: "Prepare for an interview", description: "Practise answers from your own evidence", href: "/interview", keywords: ["grill", "practice", "questions"] },
  { id: "action:manage-cvs", type: "action", label: "Upload or manage CVs", description: "Open your CV workspace", href: "/profile", keywords: ["resume", "document"] },
  { id: "action:configure-ai", type: "action", label: "Configure AI provider", description: "Choose a model and API key", href: "/settings?tab=ai", keywords: ["anthropic", "openai", "model"] },
  { id: "action:appearance", type: "action", label: "Change document appearance", description: "Choose CV and cover-letter layouts", href: "/settings?tab=appearance", keywords: ["template", "theme", "layout"] },
]

const GROUP_LABELS: Record<GlobalSearchItemType, string> = {
  action: "Actions",
  navigation: "Navigate",
  application: "Applications",
  cv: "CVs",
}

const GROUP_ORDER: GlobalSearchItemType[] = ["action", "navigation", "application", "cv"]

function ResultIcon({ type }: { type: GlobalSearchItemType }) {
  const Icon = type === "action"
    ? Sparkles
    : type === "application"
      ? BriefcaseBusiness
      : type === "cv"
        ? FileText
        : Compass
  return <Icon className="size-4" />
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const tokens = query.trim().split(/\s+/).filter((token) => token.length > 1)
  if (tokens.length === 0) return text

  const pattern = new RegExp(`(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig")
  const normalizedTokens = new Set(tokens.map((token) => token.toLowerCase()))
  return text.split(pattern).map((part, index) =>
    normalizedTokens.has(part.toLowerCase()) ? (
      <mark key={index} className="bg-transparent font-semibold text-foreground underline decoration-foreground/25 underline-offset-2">
        {part}
      </mark>
    ) : part,
  )
}

export function GlobalSearch() {
  const router = useRouter()
  const {
    userId,
    searchItems = [],
    searchItemsLoading = false,
    searchItemsError = false,
  } = useGenerationJobsContext()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const recentSearchKey = globalSearchRecentsKey(userId)

  const openSearch = useCallback(() => {
    try {
      setRecentSearches(parseRecentGlobalSearches(window.localStorage.getItem(recentSearchKey)))
    } catch {
      setRecentSearches([])
    }
    setQuery("")
    setActiveIndex(0)
    setOpen(true)
  }, [recentSearchKey])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || (!event.metaKey && !event.ctrlKey)) return
      event.preventDefault()
      if (open) setOpen(false)
      else openSearch()
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [open, openSearch])

  const allItems = useMemo(
    () => [...ACTION_ITEMS, ...NAVIGATION_ITEMS, ...searchItems],
    [searchItems],
  )
  const rankedItems = useMemo(
    () => query.trim() ? rankGlobalSearchItems(query, allItems) : [...ACTION_ITEMS.slice(0, 4), ...NAVIGATION_ITEMS.slice(0, 4)],
    [allItems, query],
  )
  const visibleItems = useMemo(
    () => GROUP_ORDER.flatMap((type) => rankedItems.filter((item) => item.type === type)),
    [rankedItems],
  )

  function closeSearch() {
    setOpen(false)
    setQuery("")
    setActiveIndex(0)
  }

  function selectItem(item: GlobalSearchItem) {
    const nextRecent = addRecentGlobalSearch(recentSearches, query)
    setRecentSearches(nextRecent)
    try {
      window.localStorage.setItem(recentSearchKey, JSON.stringify(nextRecent))
    } catch {
      // Search remains usable when storage is unavailable.
    }
    closeSearch()
    router.push(item.href)
  }

  function applyRecentSearch(value: string) {
    setQuery(value)
    setActiveIndex(0)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function clearRecentSearches() {
    try {
      window.localStorage.removeItem(recentSearchKey)
    } catch {
      // Search remains usable when storage is unavailable.
    }
    setRecentSearches([])
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (visibleItems.length === 0) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % visibleItems.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + visibleItems.length) % visibleItems.length)
    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault()
      const item = visibleItems[Math.min(activeIndex, visibleItems.length - 1)]
      if (item) selectItem(item)
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) openSearch()
        else closeSearch()
      }}
    >
      <button
        type="button"
        onClick={openSearch}
        aria-label="Search or run a command"
        aria-keyshortcuts="Meta+K Control+K"
        className="flex h-9 items-center gap-2 border border-border bg-background px-2.5 text-[12px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 sm:px-3"
      >
        <Search className="size-3.5" />
        <span className="hidden md:inline">Search</span>
        <kbd className="ml-2 hidden border border-border bg-secondary px-1.5 py-0.5 font-sans text-[10px] leading-none text-muted-foreground xl:inline">
          ⌘K
        </kbd>
      </button>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/55" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 pb-4 pt-[10vh] sm:pt-[14vh]">
          <Dialog.Popup
            initialFocus={inputRef}
            className="w-full max-w-2xl overflow-hidden border border-border bg-background shadow-2xl"
          >
            <Dialog.Title className="sr-only">Global search</Dialog.Title>
            <Dialog.Description className="sr-only">
              Search pages, applications, and CVs, or run an action.
            </Dialog.Description>

            <div className="flex items-center gap-3 border-b border-border px-4 sm:px-5">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActiveIndex(0)
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Search pages, applications, CVs, or actions…"
                aria-label="Global search"
                role="combobox"
                aria-expanded="true"
                aria-controls="global-search-results"
                aria-activedescendant={visibleItems[activeIndex] ? `global-search-result-${activeIndex}` : undefined}
                className="h-14 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
              />
              <Dialog.Close
                aria-label="Close search"
                className="flex size-8 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>

            {!query.trim() && recentSearches.length > 0 && (
              <section className="border-b border-border px-3 py-3 sm:px-4">
                <div className="mb-2 flex items-center justify-between px-2">
                  <p className="section-label">Recent searches</p>
                  <button
                    type="button"
                    onClick={clearRecentSearches}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 px-2">
                  {recentSearches.map((recent) => (
                    <button
                      key={recent}
                      type="button"
                      onClick={() => applyRecentSearch(recent)}
                      className="inline-flex items-center gap-1.5 border border-border bg-secondary/45 px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                    >
                      <Clock3 className="size-3" />
                      {recent}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {searchItemsLoading && (
              <div className="border-b border-border px-5 py-2 text-[11px] text-muted-foreground" role="status">
                Loading saved applications and CVs…
              </div>
            )}
            {!searchItemsLoading && searchItemsError && (
              <div className="border-b border-border px-5 py-2 text-[11px] text-destructive" role="status">
                Saved records could not be loaded. Pages and actions are still available.
              </div>
            )}

            <div id="global-search-results" role="listbox" className="max-h-[min(60vh,32rem)] overflow-y-auto p-2">
              {visibleItems.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <p className="text-sm font-medium">No matches found</p>
                  <p className="mt-1 text-xs text-muted-foreground">Try a role, company, CV name, or page.</p>
                </div>
              ) : (
                GROUP_ORDER.map((type) => {
                  const groupItems = visibleItems.filter((item) => item.type === type)
                  if (groupItems.length === 0) return null
                  return (
                    <section key={type} role="group" aria-labelledby={`global-search-group-${type}`} className="py-1">
                      <h3 id={`global-search-group-${type}`} className="section-label px-3 py-2">
                        {GROUP_LABELS[type]}
                      </h3>
                      {groupItems.map((item) => {
                        const itemIndex = visibleItems.indexOf(item)
                        const isActive = itemIndex === activeIndex
                        return (
                          <button
                            key={item.id}
                            id={`global-search-result-${itemIndex}`}
                            type="button"
                            role="option"
                            aria-selected={isActive}
                            onMouseEnter={() => setActiveIndex(itemIndex)}
                            onClick={() => selectItem(item)}
                            className={cn(
                              "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                              isActive ? "bg-secondary text-foreground" : "text-foreground hover:bg-secondary/60",
                            )}
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center border border-border bg-background text-muted-foreground">
                              <ResultIcon type={item.type} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium">
                                <HighlightedText text={item.label} query={query} />
                              </span>
                              <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{item.description}</span>
                            </span>
                            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                          </button>
                        )
                      })}
                    </section>
                  )
                })
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-secondary/30 px-4 py-2.5 text-[10px] text-muted-foreground">
              <span>↑↓ Move · Enter Open · Esc Close</span>
              <span>⌘K / Ctrl K</span>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
