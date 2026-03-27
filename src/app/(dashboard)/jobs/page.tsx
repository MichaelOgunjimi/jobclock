"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured, SUPABASE_SETUP_MESSAGE } from "@/lib/supabase/config"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import type { Job } from "@/lib/jobs/types"
import { Search, MapPin, Briefcase, PoundSterling, ExternalLink, Bookmark, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export default function JobsPage() {
  const [query, setQuery] = useState("")
  const [location, setLocation] = useState("")
  const [salaryMin, setSalaryMin] = useState("")
  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const isConfigured = isSupabaseConfigured()
  const supabase = isConfigured ? createClient() : null

  const fetchJobs = useCallback(
    async (searchPage = 1, isNewSearch = false) => {
      if (isNewSearch) {
        setSearching(true)
      } else {
        setLoading(true)
      }

      try {
        const params = new URLSearchParams()
        if (query) params.set("q", query)
        if (location) params.set("location", location)
        if (salaryMin) params.set("salary_min", salaryMin)
        params.set("page", String(searchPage))

        const res = await fetch(`/api/jobs/search?${params.toString()}`)
        const data = await res.json()

        if (!res.ok) {
          toast.error(data.error ?? "Failed to fetch jobs")
          return
        }

        if (isNewSearch || searchPage === 1) {
          setJobs(data.jobs)
        } else {
          setJobs((prev) => [...prev, ...data.jobs])
        }
        setTotal(data.total)
        setPage(searchPage)
      } catch (error) {
        console.error("Fetch jobs error:", error)
        toast.error("Failed to fetch jobs")
      } finally {
        setLoading(false)
        setSearching(false)
      }
    },
    [query, location, salaryMin]
  )

  useEffect(() => {
    fetchJobs(1, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    fetchJobs(1, true)
  }

  async function handleSaveJob(job: Job) {
    if (!supabase) {
      toast.error(SUPABASE_SETUP_MESSAGE)
      return
    }

    try {
      // Upsert to jobs_cache
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error: upsertError } = await supabase.from("jobs_cache").upsert(
        {
          id: job.id,
          url: job.url,
          source: job.source,
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          salary_min: job.salaryMin,
          salary_max: job.salaryMax,
          salary_currency: job.salaryCurrency,
          posted_at: job.postedAt,
          is_easy_apply: job.isEasyApply ?? false,
        },
        { onConflict: "id" }
      )

      if (upsertError) {
        toast.error("Failed to save job")
        return
      }

      // Check if already applied
      const { data: existing } = await supabase
        .from("applications")
        .select("id")
        .eq("user_id", user.id)
        .eq("job_id", job.id)
        .single()

      if (existing) {
        toast.warning("Already saved this job")
        return
      }

      // Create application record
      await supabase.from("applications").insert({
        user_id: user.id,
        job_id: job.id,
        status: "saved",
      })

      toast.success("Job saved!")
    } catch (error) {
      console.error("Save job error:", error)
      toast.error("Failed to save job")
    }
  }

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="space-y-3">
          <p className="page-kicker">Roles</p>
          <div className="space-y-2">
            <h1 className="page-title">Search with more restraint, save with more intent.</h1>
            <p className="page-lede max-w-2xl">
              Scan the market, narrow by salary and location, and pin the roles worth tailoring for.
            </p>
          </div>
        </div>
        <div className="w-full border bg-secondary px-5 py-4 md:w-auto md:min-w-52">
          <p className="section-label">Source</p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {!isConfigured || process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost")
              ? "Mock results enabled until live integrations are configured."
              : "Live Adzuna listings with local save tracking."}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:gap-8">
        <aside className="space-y-6 border bg-secondary p-6">
          <div className="space-y-2">
            <p className="section-label">Filters</p>
            <h2 className="font-heading text-[1.9rem] leading-none tracking-[-0.03em]">Refine the list</h2>
          </div>

          <form onSubmit={handleSearch} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="query">Keywords</Label>
              <Input
                id="query"
                placeholder="Software Engineer, Developer..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="London, Manchester..."
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
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search roles
            </Button>
          </form>

          <Separator />

          <div className="space-y-2 text-[13px] text-muted-foreground">
            <p className="font-medium text-foreground">{total.toLocaleString()} roles found</p>
            <p>Use search to keep only roles that fit your current CV and salary floor.</p>
          </div>
        </aside>

        <div className="min-h-0 border">
          <div className="flex flex-col gap-3 border-b px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-label">Open roles</p>
              <h2 className="mt-2 font-heading text-[2rem] leading-none tracking-[-0.03em]">Results</h2>
            </div>
            <p className="text-[13px] text-muted-foreground">Save promising roles directly into your application pipeline.</p>
          </div>

          <ScrollArea className="h-auto lg:h-[calc(100vh-22rem)]">
            <div className="space-y-3 p-4 md:p-6">
            {jobs.length === 0 && !loading ? (
              <div className="border bg-secondary px-6 py-14 text-center text-muted-foreground">
                <Briefcase className="mx-auto mb-4 h-10 w-10" />
                <p className="font-medium text-foreground">No jobs found</p>
                <p className="mt-2 text-sm">Try broadening the location or lowering the salary floor.</p>
              </div>
            ) : (
              jobs.map((job) => (
                <JobCard key={job.id} job={job} onSave={() => handleSaveJob(job)} />
              ))
            )}

            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && jobs.length > 0 && jobs.length < total && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchJobs(page + 1)}
                  disabled={loading}
                >
                  Load More ({total - jobs.length} remaining)
                </Button>
              </div>
            )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

function JobCard({ job, onSave }: { job: Job; onSave: () => void }) {
  return (
    <Card className="transition-colors hover:bg-secondary/70">
      <CardHeader className="border-b pb-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate text-[1.45rem]">{job.title}</CardTitle>
            <CardDescription className="mt-2 flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {job.company}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {job.isEasyApply && (
              <Badge variant="outline" className="border-accent/20 bg-accent/10 text-accent">
                Easy Apply
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={onSave}>
              <Bookmark className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
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
              {job.salaryMax ? ` - ${job.salaryMax.toLocaleString()}` : ""}
            </span>
          )}
          {job.postedAt && (
            <span className="flex items-center gap-1">
              {formatDistanceToNow(new Date(job.postedAt), { addSuffix: true })}
            </span>
          )}
        </div>

        {job.description && (
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            {job.description}
          </p>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" asChild>
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              View role
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={onSave}>
            Save Job
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
