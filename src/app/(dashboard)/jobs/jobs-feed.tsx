"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { saveJob, ignoreJob } from "./actions"
import { EXPERIENCE_LEVELS } from "@/app/(dashboard)/profile/profile-tabs"
import type { Job } from "@/lib/jobs/types"
import { deduplicateJobs } from "@/lib/jobs/dedup"
import {
  Search,
  MapPin,
  Briefcase,
  PoundSterling,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Loader2,
  EyeOff,
  Wifi,
} from "lucide-react"
import { formatDistanceToNow, differenceInDays } from "date-fns"

interface JobsFeedProps {
  initialQuery: string
  initialLocation: string
  initialSalary: string
  initialExperienceLevels: string[]
  enabledSources: string[]
  initialSavedUrls: string[]
  initialIgnoredUrls?: string[]
}

const SOURCE_LABELS: Record<string, string> = {
  adzuna: "Adzuna",
  reed: "Reed",
  careerjet: "Careerjet",
  tracked: "Tracked",
}

const JOBS_PER_PAGE = 20
// One API page per source per batch. Keeps Adzuna from 429-ing (5 parallel
// requests triggered their rate-limiter). Pool still grows globally sorted
// as the user loads more — each load appends one new page per source.
const BATCH_SIZE = 1

function sortJobsBy(jobs: Job[], by: "relevance" | "date" | "salary"): Job[] {
  if (by === "date") {
    return [...jobs].sort((a, b) => {
      // Fall back to lastSeenAt for ATS jobs that have no postedAt (keeps freshly-synced jobs visible)
      const ta = a.postedAt ? new Date(a.postedAt).getTime() : (a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0)
      const tb = b.postedAt ? new Date(b.postedAt).getTime() : (b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0)
      return tb - ta
    })
  }
  if (by === "salary") {
    return [...jobs].sort((a, b) => {
      const sa = a.salaryMax ?? a.salaryMin ?? 0
      const sb = b.salaryMax ?? b.salaryMin ?? 0
      return sb - sa
    })
  }
  return jobs  // relevance: keep API order
}

const EXPERIENCE_KEYWORDS: Record<string, string[]> = {
  entry_level: ["entry", "entry-level", "entry level", "junior", "associate", "graduate", "trainee", "apprentice"],
  graduate:    ["graduate", "grad ", "entry", "junior", "trainee", "intern"],
  junior:      ["junior", "jr ", "jr.", "entry", "associate", "graduate"],
  mid:         ["mid", "mid-level", "intermediate", "software engineer", "developer", "engineer"],
  senior:      ["senior", "sr ", "sr.", "lead", "principal", "staff", "architect", "head of"],
  lead:        ["lead", "principal", "staff", "head", "architect", "director"],
}

function filterByExperience(jobs: Job[], levels: string[]): Job[] {
  if (levels.length === 0) return jobs
  return jobs.filter((job) => {
    const haystack = `${job.title} ${job.description ?? ""}`.toLowerCase()
    return levels.some((level) =>
      (EXPERIENCE_KEYWORDS[level] ?? []).some((kw) => haystack.includes(kw))
    )
  })
}

export function JobsFeed({
  initialQuery,
  initialLocation,
  initialSalary,
  initialExperienceLevels,
  enabledSources,
  initialSavedUrls,
  initialIgnoredUrls = [],
}: JobsFeedProps) {
  const [query, setQuery] = useState(initialQuery)
  const [location, setLocation] = useState(initialLocation)
  const [salary, setSalary] = useState(initialSalary)
  const [sortBy, setSortBy] = useState<"relevance" | "date" | "salary">("date")
  const [experienceLevels, setExperienceLevels] = useState<string[]>(initialExperienceLevels)
  const [selectedSources, setSelectedSources] = useState<string[]>(
    enabledSources.length > 0 ? enabledSources : ["adzuna"]
  )
  // Pool of all jobs fetched so far across all batches, globally sorted
  const [poolJobs, setPoolJobs] = useState<Job[]>([])
  // Which display page (1-indexed) within the local pool we're showing
  const [displayPage, setDisplayPage] = useState(1)
  // Which API batch we last fetched (1 = pages 1-3, 2 = pages 4-6, …)
  const [apiBatch, setApiBatch] = useState(0)
  // True if the last batch came back full — more results may exist on the server
  const [hasMoreServer, setHasMoreServer] = useState(true)
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const resultsScrollRef = useRef<HTMLDivElement>(null)
  // Persists across batches — prevents the same job appearing in two different batches
  const seenUrlsRef = useRef<Set<string>>(new Set())

  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set(initialSavedUrls))
  const [ignoredUrls, setIgnoredUrls] = useState<Set<string>>(new Set(initialIgnoredUrls))
  const [showHidden, setShowHidden] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [titleIncludes, setTitleIncludes] = useState("")
  const [titleExcludes, setTitleExcludes] = useState("")

  // Auto-search on first mount when preferences are pre-filled
  const didAutoSearch = useRef(false)
  useEffect(() => {
    if (!didAutoSearch.current && (initialQuery || initialLocation)) {
      didAutoSearch.current = true
      void fetchBatch(1, false, [])
    }
  // fetchBatch is stable across renders — the ref guard prevents double-firing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const deduplicated = deduplicateJobs(poolJobs)
  const filteredByExperience = filterByExperience(deduplicated, experienceLevels)
  const filteredByTitle = filteredByExperience.filter((j) => {
    const title = j.title.toLowerCase()
    if (titleIncludes && !title.includes(titleIncludes.toLowerCase())) return false
    if (titleExcludes && title.includes(titleExcludes.toLowerCase())) return false
    return true
  })
  const processedJobs = showHidden
    ? filteredByTitle
    : filteredByTitle.filter((j) => !ignoredUrls.has(j.url))

  const totalDisplayPages = Math.max(1, Math.ceil(processedJobs.length / JOBS_PER_PAGE))
  // Clamp so that if a batch load doesn't add a new full page the display page
  // stays valid and the user sees the last available page rather than an empty one.
  const safePage = Math.min(displayPage, totalDisplayPages)
  const displayStart = (safePage - 1) * JOBS_PER_PAGE
  const jobs = processedJobs.slice(displayStart, displayStart + JOBS_PER_PAGE)

  // Fetches BATCH_SIZE API pages in parallel, merges into the local pool, and sorts
  // globally. append=false resets the pool (new search); append=true extends it
  // (loading more). existingPool must be passed explicitly to avoid stale closure.
  async function fetchBatch(
    batchNum: number,
    append: boolean,
    existingPool: Job[],
    overrideSort?: typeof sortBy,
    overrideLevels?: string[]
  ): Promise<{ newJobsAdded: number }> {
    if (append) setLoadingMore(true)
    else setSearching(true)

    if (!append) seenUrlsRef.current = new Set()

    try {
      const effectiveSort = overrideSort ?? sortBy
      const effectiveLevels = overrideLevels !== undefined ? overrideLevels : experienceLevels
      const startApiPage = (batchNum - 1) * BATCH_SIZE + 1

      const responses = await Promise.all(
        Array.from({ length: BATCH_SIZE }, (_, i) => {
          const params = new URLSearchParams()
          if (query) params.set("q", query)
          if (location) params.set("location", location)
          if (salary) params.set("salary_min", salary)
          params.set("sort", effectiveSort)
          if (effectiveLevels.length > 0) params.set("experience", effectiveLevels.join(","))
          if (selectedSources.length > 0) params.set("sources", selectedSources.join(","))
          params.set("page", String(startApiPage + i))
          params.set("per_page", String(JOBS_PER_PAGE))
          return fetch(`/api/jobs/search?${params.toString()}`)
            .then(r => r.json() as Promise<{ jobs?: Job[]; error?: string }>)
        })
      )

      const batchJobs: Job[] = []
      let fullPageCount = 0
      for (const data of responses) {
        const page = data.jobs ?? []
        if (page.length >= JOBS_PER_PAGE) fullPageCount++
        batchJobs.push(...page)
      }

      const uniqueNew = batchJobs.filter(j => {
        if (seenUrlsRef.current.has(j.url)) return false
        seenUrlsRef.current.add(j.url)
        return true
      })

      const merged = append ? [...existingPool, ...uniqueNew] : uniqueNew
      const sorted = sortJobsBy(merged, effectiveSort)

      setPoolJobs(sorted)
      setApiBatch(batchNum)
      // Only signal "more available" if the API returned a full page AND we actually
      // got new unique jobs. If all results were duplicates there's no point fetching
      // another batch — the pool won't grow and the user gets stuck on the same page.
      setHasMoreServer(fullPageCount > 0 && uniqueNew.length > 0)
      setHasSearched(true)

      if (!append) {
        setDisplayPage(1)
        resultsScrollRef.current?.scrollTo({ top: 0, behavior: "instant" })
      }

      return { newJobsAdded: uniqueNew.length }
    } catch {
      toast.error("Failed to fetch jobs")
      return { newJobsAdded: 0 }
    } finally {
      setSearching(false)
      setLoadingMore(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    void fetchBatch(1, false, [])
  }

  function toggleSource(source: string) {
    setSelectedSources((prev) =>
      prev.includes(source)
        ? prev.length > 1
          ? prev.filter((s) => s !== source)
          : prev // keep at least one selected
        : [...prev, source]
    )
  }

  function toggleExperienceLevel(level: string) {
    const next = experienceLevels.includes(level)
      ? experienceLevels.filter((l) => l !== level)
      : [...experienceLevels, level]
    setExperienceLevels(next)
    if (hasSearched) void fetchBatch(1, false, [], undefined, next)
  }

  async function handleSaveJob(job: Job) {
    if (savedUrls.has(job.url)) {
      toast.info("Already in your pipeline")
      return
    }

    const result = await saveJob(job)
    if (result?.error) {
      toast.error(result.error)
    } else if (result?.alreadySaved) {
      toast.info("Already in your pipeline")
      setSavedUrls((prev) => new Set([...prev, job.url]))
    } else {
      toast.success("Saved to pipeline")
      setSavedUrls((prev) => new Set([...prev, job.url]))
    }
  }

  async function handleIgnoreJob(job: Job) {
    setIgnoredUrls((prev) => new Set([...prev, job.url]))
    await ignoreJob(job.url)
  }

  async function handlePrevPage() {
    if (displayPage > 1) {
      setDisplayPage(p => p - 1)
      resultsScrollRef.current?.scrollTo({ top: 0, behavior: "instant" })
    }
  }

  async function handleNextPage() {
    const nextPage = displayPage + 1
    if (nextPage <= totalDisplayPages) {
      setDisplayPage(nextPage)
      resultsScrollRef.current?.scrollTo({ top: 0, behavior: "instant" })
    } else if (hasMoreServer && !loadingMore && !searching) {
      const { newJobsAdded } = await fetchBatch(apiBatch + 1, true, poolJobs)
      if (newJobsAdded > 0) {
        setDisplayPage(nextPage)
        resultsScrollRef.current?.scrollTo({ top: 0, behavior: "instant" })
      }
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-8">
      {/* Sidebar */}
      <aside className="space-y-6 border bg-secondary p-6">
        <div className="space-y-2">
          <p className="section-label">Filters</p>
          <h2 className="font-heading text-[1.9rem] leading-none tracking-[-0.03em]">
            Refine the list
          </h2>
        </div>

        <form onSubmit={handleSearch} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="query">Keywords</Label>
            <Input
              id="query"
              placeholder="Software Engineer, Developer…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="London, Manchester…"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title-includes">Title includes</Label>
            <Input
              id="title-includes"
              placeholder="e.g. Engineer"
              value={titleIncludes}
              onChange={(e) => setTitleIncludes(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title-excludes">Title excludes</Label>
            <Input
              id="title-excludes"
              placeholder="e.g. Manager"
              value={titleExcludes}
              onChange={(e) => setTitleExcludes(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="salary">Minimum Salary</Label>
            <div className="relative">
              <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="salary"
                type="number"
                placeholder="25000"
                className="pl-8"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sort">Sort by</Label>
            <select
              id="sort"
              value={sortBy}
              onChange={(e) => {
                const val = e.target.value as typeof sortBy
                setSortBy(val)
                if (hasSearched) void fetchBatch(1, false, [], val)
              }}
              className="form-select"
            >
              <option value="relevance">Relevance</option>
              <option value="date">Most recent</option>
              <option value="salary">Salary</option>
            </select>
          </div>

          {/* Experience level chips */}
          <div className="space-y-2">
            <Label>Experience Level</Label>
            <div className="flex flex-wrap gap-1.5">
              {EXPERIENCE_LEVELS.map((level) => {
                const active = experienceLevels.includes(level.value)
                return (
                  <button
                    key={level.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleExperienceLevel(level.value)}
                    className={cn(
                      "border px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {level.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Source selector */}
          <div className="space-y-2">
            <Label>Sources</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedSources([...enabledSources])}
                className={cn(
                  "border px-2.5 py-1 text-xs font-medium transition-colors",
                  selectedSources.length === enabledSources.length
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                All
              </button>
              {enabledSources.map((source) => {
                const active = selectedSources.includes(source)
                return (
                  <button
                    key={source}
                    type="button"
                    onClick={() => toggleSource(source)}
                    className={cn(
                      "border px-2.5 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {SOURCE_LABELS[source] ?? source}
                  </button>
                )
              })}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={searching}>
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search roles
          </Button>
        </form>

        {hasSearched && (
          <div className="text-[13px] text-muted-foreground">
            <p className="font-medium text-foreground">
              {poolJobs.length.toLocaleString()} roles loaded
              {hasMoreServer && <span className="font-normal"> · more available</span>}
            </p>
            {deduplicated.length < poolJobs.length && (
              <p className="mt-1 text-xs">
                {poolJobs.length - deduplicated.length} duplicate{poolJobs.length - deduplicated.length === 1 ? "" : "s"} hidden
              </p>
            )}
            {(titleIncludes || titleExcludes) && (
              <p className="mt-1 text-xs">
                {filteredByTitle.length} match title filter
              </p>
            )}
            {processedJobs.length > 0 && (
              <p className="mt-1">
                Page {safePage} of {totalDisplayPages}
                {hasMoreServer && <span className="ml-1 text-xs">· more to load</span>}
              </p>
            )}
            {ignoredUrls.size > 0 && (
              <button
                type="button"
                onClick={() => setShowHidden((v) => !v)}
                className="mt-1 text-xs underline underline-offset-2 hover:text-foreground"
              >
                {showHidden ? "Hide hidden jobs" : `Show ${ignoredUrls.size} hidden job${ignoredUrls.size === 1 ? "" : "s"}`}
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Results */}
      <div className="min-h-0 border">
        <div className="flex flex-col gap-3 border-b px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-label">Open roles</p>
            <h2 className="mt-2 font-heading text-[2rem] leading-none tracking-[-0.03em]">
              Results
            </h2>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Save promising roles into your application pipeline.
          </p>
        </div>

        <ScrollArea className="h-[calc(100vh-16rem)] lg:h-[calc(100vh-22rem)]" viewportRef={resultsScrollRef}>
          <div className="space-y-3 p-4 md:p-6">
            {!hasSearched && !searching ? (
              <div className="border bg-secondary px-6 py-14 text-center text-muted-foreground">
                <Search className="mx-auto mb-4 h-10 w-10 opacity-30" />
                <p className="font-medium text-foreground">Run a search</p>
                <p className="mt-2 text-sm">
                  Filters are pre-filled from your preferences — adjust and hit Search.
                </p>
              </div>
            ) : jobs.length === 0 && !searching ? (
              <div className="border bg-secondary px-6 py-14 text-center text-muted-foreground">
                <Briefcase className="mx-auto mb-4 h-10 w-10 opacity-30" />
                <p className="font-medium text-foreground">No jobs found</p>
                <p className="mt-2 text-sm">
                  {filteredByTitle.length === 0 && (titleIncludes || titleExcludes)
                    ? "The title filter removed all results. Try clearing the include/exclude fields."
                    : filteredByExperience.length > 0 && experienceLevels.length > 0
                    ? "The experience filter removed all results. Try deselecting some levels."
                    : !hasMoreServer
                    ? "You've seen all available unique results for this search."
                    : "Try broadening the keywords, location, or lowering the salary floor."}
                </p>
              </div>
            ) : (
              jobs.map((job) => (
                <JobCard
                  key={job.url}
                  job={job}
                  isSaved={savedUrls.has(job.url)}
                  isHidden={ignoredUrls.has(job.url)}
                  onSave={() => handleSaveJob(job)}
                  onHide={() => handleIgnoreJob(job)}
                />
              ))
            )}

            {searching && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </ScrollArea>

        {hasSearched && (totalDisplayPages > 1 || hasMoreServer) && (
          <div className="flex flex-col gap-3 border-t px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              Page <span className="font-medium text-foreground">{safePage}</span> of{" "}
              <span className="font-medium text-foreground">{totalDisplayPages}</span>
              {hasMoreServer && safePage === totalDisplayPages && (
                <span className="ml-1 text-xs">· next page loads more</span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handlePrevPage()}
                disabled={searching || loadingMore || safePage === 1}
              >
                Previous
              </Button>
              {getVisiblePages(safePage, totalDisplayPages).map((entry, index) =>
                entry === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="px-2 text-sm text-muted-foreground">…</span>
                ) : (
                  <Button
                    key={entry}
                    type="button"
                    size="sm"
                    variant={entry === safePage ? "default" : "outline"}
                    onClick={() => { setDisplayPage(entry); resultsScrollRef.current?.scrollTo({ top: 0, behavior: "instant" }) }}
                    disabled={searching || loadingMore}
                    aria-current={entry === safePage ? "page" : undefined}
                  >
                    {entry}
                  </Button>
                )
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleNextPage()}
                disabled={searching || loadingMore || (safePage === totalDisplayPages && !hasMoreServer)}
              >
                {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Next"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getVisiblePages(currentPage: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages]
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages]
}

function freshnessInfo(lastSeenAt: string | null | undefined): { label: string; className: string } | null {
  if (!lastSeenAt) return null
  const days = differenceInDays(new Date(), new Date(lastSeenAt))
  if (days < 3) return { label: "Fresh", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" }
  if (days < 7) return { label: "Recent", className: "border-border bg-secondary text-muted-foreground" }
  return { label: "Stale", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" }
}

function JobCard({
  job,
  isSaved,
  isHidden,
  onSave,
  onHide,
}: {
  job: Job
  isSaved: boolean
  isHidden: boolean
  onSave: () => Promise<void>
  onHide: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const freshness = freshnessInfo(job.lastSeenAt)

  function handleSave() {
    startTransition(async () => {
      await onSave()
    })
  }

  return (
    <div className={cn("border bg-card transition-colors hover:border-foreground/30", isHidden && "opacity-50")}>
      <div className="border-b px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[1.1rem] font-semibold leading-tight">{job.title}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <Briefcase className="h-3 w-3 shrink-0" />
              {job.company}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {freshness && (
              <span className={cn("border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide", freshness.className)}>
                {freshness.label}
              </span>
            )}
            {job.remoteType && (
              <span className="flex items-center gap-1 border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <Wifi className="h-2.5 w-2.5" />
                {job.remoteType}
              </span>
            )}
            <span className="border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {SOURCE_LABELS[job.source] ?? job.source}
            </span>
            {job.isEasyApply && (
              <span className="border border-foreground/15 bg-foreground/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground">
                Easy Apply
              </span>
            )}
            {isSaved && (
              <span className="border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Saved
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {job.location}
            </span>
          )}
          {job.salaryMin && (
            <span className="flex items-center gap-1">
              <PoundSterling className="h-3 w-3" />
              {job.salaryMin.toLocaleString()}
              {job.salaryMax ? `–${job.salaryMax.toLocaleString()}` : ""}
            </span>
          )}
          {job.postedAt && (
            <span>{formatDistanceToNow(new Date(job.postedAt), { addSuffix: true })}</span>
          )}
          {job.lastSeenAt && freshness?.label === "Stale" && (
            <span className="text-amber-600 dark:text-amber-400">
              Last verified {formatDistanceToNow(new Date(job.lastSeenAt), { addSuffix: true })}
            </span>
          )}
        </div>

        {job.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {job.description}
          </p>
        )}

        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
          <Button size="sm" variant="outline" className="w-full sm:w-auto" asChild>
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              View role
            </a>
          </Button>
          <Button
            size="sm"
            variant="default"
            className="w-full sm:w-auto"
            onClick={handleSave}
            disabled={isPending || isSaved}
          >
            {isSaved ? (
              <BookmarkCheck className="h-3.5 w-3.5" />
            ) : (
              <Bookmark className="h-3.5 w-3.5" />
            )}
            {isSaved ? "Saved" : "Save to pipeline"}
          </Button>
          {!isSaved && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground sm:w-auto"
              onClick={onHide}
            >
              <EyeOff className="h-3.5 w-3.5" />
              Hide
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
