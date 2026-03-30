"use client"

import { useState, useTransition, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { saveJob } from "./actions"
import { EXPERIENCE_LEVELS } from "@/app/(dashboard)/profile/profile-tabs"
import type { Job } from "@/lib/jobs/types"
import {
  Search,
  MapPin,
  Briefcase,
  PoundSterling,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Loader2,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"

interface JobsFeedProps {
  initialQuery: string
  initialLocation: string
  initialSalary: string
  initialExperienceLevels: string[]
  enabledSources: string[]
  initialSavedUrls: string[]
}

const SOURCE_LABELS: Record<string, string> = {
  adzuna: "Adzuna",
  reed: "Reed",
  careerjet: "Careerjet",
}

const JOBS_PER_PAGE = 50

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
}: JobsFeedProps) {
  const [query, setQuery] = useState(initialQuery)
  const [location, setLocation] = useState(initialLocation)
  const [salary, setSalary] = useState(initialSalary)
  const [sortBy, setSortBy] = useState<"relevance" | "date" | "salary">("relevance")
  const [experienceLevels, setExperienceLevels] = useState<string[]>(initialExperienceLevels)
  const [selectedSources, setSelectedSources] = useState<string[]>(
    enabledSources.length > 0 ? enabledSources : ["adzuna"]
  )
  const [rawJobs, setRawJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searching, setSearching] = useState(false)
  const resultsScrollRef = useRef<HTMLDivElement>(null)
  // Track URLs seen across all pages to avoid cross-page duplicates from parallel queries
  const seenUrlsRef = useRef<Set<string>>(new Set())

  const jobs = filterByExperience(rawJobs, experienceLevels)
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set(initialSavedUrls))
  const [hasSearched, setHasSearched] = useState(false)

  async function fetchJobs(searchPage = 1, overrideSort?: typeof sortBy, overrideLevels?: string[]) {
    setSearching(true)

    try {
      const params = new URLSearchParams()
      if (query) params.set("q", query)
      if (location) params.set("location", location)
      if (salary) params.set("salary_min", salary)
      params.set("sort", overrideSort ?? sortBy)
      const levels = overrideLevels !== undefined ? overrideLevels : experienceLevels
      if (levels.length > 0) params.set("experience", levels.join(","))
      if (selectedSources.length > 0) params.set("sources", selectedSources.join(","))
      params.set("page", String(searchPage))
      params.set("per_page", String(JOBS_PER_PAGE))

      const res = await fetch(`/api/jobs/search?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Failed to fetch jobs")
        return
      }

      // On new search (page 1) reset the cross-page dedup tracker
      if (searchPage === 1) seenUrlsRef.current = new Set()

      // Filter out any URLs already shown on previous pages
      const newJobs = (data.jobs ?? []).filter((job: Job) => {
        if (seenUrlsRef.current.has(job.url)) return false
        seenUrlsRef.current.add(job.url)
        return true
      })

      setRawJobs(newJobs)
      setTotal(data.total ?? 0)
      setPage(searchPage)
      setHasSearched(true)
      resultsScrollRef.current?.scrollTo({ top: 0, behavior: "instant" })
    } catch {
      toast.error("Failed to fetch jobs")
    } finally {
      setSearching(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    fetchJobs(1)
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
    if (hasSearched) fetchJobs(1, undefined, next)
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

  const totalPages = Math.max(1, Math.ceil(total / JOBS_PER_PAGE))

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
                if (hasSearched) fetchJobs(1, val)
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
            <p className="font-medium text-foreground">{total.toLocaleString()} roles found</p>
            {experienceLevels.length > 0 && rawJobs.length > 0 && (
              <p className="mt-1">
                {jobs.length === 0
                  ? "No results match the selected experience levels"
                  : jobs.length < rawJobs.length
                  ? `${jobs.length} match experience filter`
                  : null}
              </p>
            )}
            {jobs.length > 0 && (
              <p className="mt-1">
                Page {page} of {totalPages}
              </p>
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

        <ScrollArea className="h-auto lg:h-[calc(100vh-22rem)]" viewportRef={resultsScrollRef}>
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
                  {rawJobs.length > 0 && experienceLevels.length > 0
                    ? "The experience filter removed all results. Try deselecting some levels."
                    : "Try broadening the keywords, location, or lowering the salary floor."}
                </p>
              </div>
            ) : (
              jobs.map((job) => (
                <JobCard
                  key={job.url}
                  job={job}
                  isSaved={savedUrls.has(job.url)}
                  onSave={() => handleSaveJob(job)}
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

        {hasSearched && jobs.length > 0 && totalPages > 1 && (
          <div className="flex flex-col gap-3 border-t px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing page <span className="font-medium text-foreground">{page}</span> of{" "}
              <span className="font-medium text-foreground">{totalPages}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchJobs(page - 1)}
                disabled={searching || page === 1}
              >
                Previous
              </Button>
              {getVisiblePages(page, totalPages).map((entry, index) =>
                entry === "ellipsis" ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-2 text-sm text-muted-foreground"
                  >
                    …
                  </span>
                ) : (
                  <Button
                    key={entry}
                    type="button"
                    size="sm"
                    variant={entry === page ? "default" : "outline"}
                    onClick={() => fetchJobs(entry)}
                    disabled={searching}
                    aria-current={entry === page ? "page" : undefined}
                  >
                    {entry}
                  </Button>
                )
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fetchJobs(page + 1)}
                disabled={searching || page === totalPages}
              >
                Next
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

function JobCard({
  job,
  isSaved,
  onSave,
}: {
  job: Job
  isSaved: boolean
  onSave: () => Promise<void>
}) {
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      await onSave()
    })
  }

  return (
    <div className="border bg-card transition-colors hover:border-foreground/30">
      <div className="border-b px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[1.1rem] font-semibold leading-tight">{job.title}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <Briefcase className="h-3 w-3 shrink-0" />
              {job.company}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Source badge */}
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
        </div>
      </div>
    </div>
  )
}
