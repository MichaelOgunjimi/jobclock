"use client"

import { useState, useTransition } from "react"
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
  initialSavedIds: string[]
}

const SOURCE_LABELS: Record<string, string> = {
  adzuna: "Adzuna",
  reed: "Reed",
}

export function JobsFeed({
  initialQuery,
  initialLocation,
  initialSalary,
  initialExperienceLevels,
  enabledSources,
  initialSavedIds,
}: JobsFeedProps) {
  const [query, setQuery] = useState(initialQuery)
  const [location, setLocation] = useState(initialLocation)
  const [salary, setSalary] = useState(initialSalary)
  const [experienceLevels, setExperienceLevels] = useState<string[]>(initialExperienceLevels)
  const [selectedSources, setSelectedSources] = useState<string[]>(
    enabledSources.length > 0 ? enabledSources : ["adzuna"]
  )
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(initialSavedIds))
  const [hasSearched, setHasSearched] = useState(false)

  async function fetchJobs(searchPage = 1, append = false) {
    if (searchPage === 1) setSearching(true)
    else setLoadingMore(true)

    try {
      const params = new URLSearchParams()
      if (query) params.set("q", query)
      if (location) params.set("location", location)
      if (salary) params.set("salary_min", salary)
      if (selectedSources.length > 0) params.set("sources", selectedSources.join(","))
      params.set("page", String(searchPage))

      const res = await fetch(`/api/jobs/search?${params.toString()}`)
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Failed to fetch jobs")
        return
      }

      if (append) {
        setJobs((prev) => [...prev, ...data.jobs])
      } else {
        setJobs(data.jobs)
      }
      setTotal(data.total)
      setPage(searchPage)
      setHasSearched(true)
    } catch {
      toast.error("Failed to fetch jobs")
    } finally {
      setSearching(false)
      setLoadingMore(false)
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
    setExperienceLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    )
  }

  async function handleSaveJob(job: Job) {
    if (savedIds.has(job.id)) {
      toast.info("Already in your pipeline")
      return
    }

    const result = await saveJob(job)
    if (result?.error) {
      toast.error(result.error)
    } else if (result?.alreadySaved) {
      toast.info("Already in your pipeline")
      setSavedIds((prev) => new Set([...prev, job.id]))
    } else {
      toast.success("Saved to pipeline")
      setSavedIds((prev) => new Set([...prev, job.id]))
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

          {/* Source selector — only show if multiple sources available */}
          {enabledSources.length > 1 && (
            <div className="space-y-2">
              <Label>Sources</Label>
              <div className="flex flex-wrap gap-1.5">
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
          )}

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

        <ScrollArea className="h-auto lg:h-[calc(100vh-22rem)]">
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
                  Try broadening the keywords, location, or lowering the salary floor.
                </p>
              </div>
            ) : (
              jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSaved={savedIds.has(job.id)}
                  onSave={() => handleSaveJob(job)}
                />
              ))
            )}

            {searching && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!searching && jobs.length > 0 && jobs.length < total && (
              <div className="pt-4 text-center">
                <Button
                  variant="outline"
                  onClick={() => fetchJobs(page + 1, true)}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Load more ({total - jobs.length} remaining)
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

function JobCard({
  job,
  isSaved,
  onSave,
}: {
  job: Job
  isSaved: boolean
  onSave: () => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(() => {
      onSave()
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
            variant={isSaved ? "secondary" : "outline"}
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
