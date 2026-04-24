"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Building2, ChevronDown, ChevronRight, Plus, RefreshCw, Trash2, ToggleLeft, ToggleRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import {
  addTrackedCompany,
  deleteTrackedCompany,
  toggleTrackedCompany,
  type TrackedCompany,
} from "./actions"
import { PRESET_COMPANIES, PRESET_CATEGORIES, type PresetCompany } from "@/lib/jobs/preset-companies"

const ATS_LABELS: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  unknown: "Unknown",
}

const ATS_COLORS: Record<string, string> = {
  greenhouse: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  lever: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  ashby: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400",
  unknown: "border-border bg-secondary text-muted-foreground",
}

function AtsBadge({ atsType }: { atsType: string | null }) {
  const key = atsType ?? "unknown"
  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 text-xs font-medium",
        ATS_COLORS[key] ?? ATS_COLORS.unknown
      )}
    >
      {ATS_LABELS[key] ?? key}
    </span>
  )
}

function SyncStatusText({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  if (!lastSyncedAt) return <span className="text-xs text-muted-foreground">Never synced</span>
  return (
    <span className="text-xs text-muted-foreground">
      Synced {formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}
    </span>
  )
}

function PresetBrowser({
  trackedUrls,
  onAdd,
}: {
  trackedUrls: Set<string>
  onAdd: (company: PresetCompany) => void
}) {
  const [open, setOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>(PRESET_CATEGORIES[0])
  const [adding, setAdding] = useState<string | null>(null)

  const companiesInCategory = PRESET_COMPANIES.filter((c) => c.category === activeCategory)

  return (
    <div className="border border-dashed border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-xs uppercase tracking-wider text-muted-foreground">Browse popular companies</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border">
          {/* Category tabs */}
          <div className="flex flex-wrap gap-1 p-3 pb-0">
            {PRESET_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "border px-2.5 py-1 text-xs font-medium transition-colors",
                  activeCategory === cat
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Company list */}
          <div className="divide-y divide-border p-3 pt-2">
            {companiesInCategory.map((preset) => {
              const alreadyTracked = trackedUrls.has(preset.careersUrl)
              return (
                <div key={preset.careersUrl} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{preset.name}</p>
                    <p className="text-xs text-muted-foreground">{preset.notes}</p>
                  </div>
                  <button
                    type="button"
                    disabled={alreadyTracked || adding === preset.careersUrl}
                    onClick={async () => {
                      setAdding(preset.careersUrl)
                      await onAdd(preset)
                      setAdding(null)
                    }}
                    className={cn(
                      "shrink-0 border px-2.5 py-1 text-xs font-medium transition-colors",
                      alreadyTracked
                        ? "border-border bg-secondary text-muted-foreground cursor-default"
                        : "border-foreground/30 hover:border-foreground hover:bg-foreground hover:text-background"
                    )}
                  >
                    {alreadyTracked ? "Added" : adding === preset.careersUrl ? "Adding…" : "Add"}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export function TrackedCompaniesForm({ initial }: { initial: TrackedCompany[] }) {
  const [companies, setCompanies] = useState<TrackedCompany[]>(initial)
  const [newName, setNewName] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const [isSyncing, startSyncTransition] = useTransition()
  const [isAdding, startAddTransition] = useTransition()

  const trackedUrls = new Set(companies.map((c) => c.careersUrl))

  async function handleAddPreset(preset: PresetCompany) {
    if (trackedUrls.has(preset.careersUrl)) return
    const result = await addTrackedCompany(preset.name, preset.careersUrl)
    if ("error" in result) {
      toast.error(result.error)
      return
    }
    setCompanies((prev) => [
      ...prev,
      {
        id: result.id,
        name: preset.name,
        careersUrl: preset.careersUrl,
        atsType: null,
        atsBoardIdentifier: null,
        enabled: true,
        lastSyncedAt: null,
        createdAt: new Date().toISOString(),
      },
    ])
    toast.success(`${preset.name} added`)
  }

  function handleAdd() {
    const name = newName.trim()
    const url = newUrl.trim()
    if (!name || !url) return

    try {
      new URL(url)
    } catch {
      toast.error("Invalid URL — enter a full careers page URL including https://")
      return
    }

    startAddTransition(async () => {
      const result = await addTrackedCompany(name, url)
      if ("error" in result) {
        toast.error(result.error)
        return
      }

      setCompanies((prev) => [
        ...prev,
        {
          id: result.id,
          name,
          careersUrl: url,
          atsType: null,
          atsBoardIdentifier: null,
          enabled: true,
          lastSyncedAt: null,
          createdAt: new Date().toISOString(),
        },
      ])
      setNewName("")
      setNewUrl("")
      toast.success(`${name} added`)
    })
  }

  function handleToggle(id: string, enabled: boolean) {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, enabled } : c)))
    startSyncTransition(async () => {
      const result = await toggleTrackedCompany(id, enabled)
      if (result.error) toast.error(result.error)
    })
  }

  function handleDelete(id: string, name: string) {
    setCompanies((prev) => prev.filter((c) => c.id !== id))
    startSyncTransition(async () => {
      const result = await deleteTrackedCompany(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`${name} removed`)
      }
    })
  }

  async function handleSyncAll() {
    startSyncTransition(async () => {
      try {
        const res = await fetch("/api/tracked-companies/sync", { method: "POST" })
        const data = await res.json() as { synced?: number; companies?: Array<{ companyName: string; synced: number; errors: string[] }>; error?: string }

        if (!res.ok || data.error) {
          toast.error(data.error ?? "Sync failed")
          return
        }

        const now = new Date().toISOString()
        setCompanies((prev) => prev.map((c) => ({ ...c, lastSyncedAt: now })))
        toast.success(`Synced ${data.synced ?? 0} jobs from tracked companies`)
      } catch {
        toast.error("Sync failed — check your connection")
      }
    })
  }

  return (
    <div className="space-y-6">
      {companies.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Building2 className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No tracked companies yet</p>
          <p className="text-xs text-muted-foreground/70">Add a company careers page below to start monitoring their openings</p>
        </div>
      ) : (
        <div className="space-y-2">
          {companies.map((company) => (
            <div
              key={company.id}
              className="flex flex-col gap-3 border border-border bg-secondary px-4 py-3 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{company.name}</p>
                    <AtsBadge atsType={company.atsType} />
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{company.careersUrl}</p>
                  <SyncStatusText lastSyncedAt={company.lastSyncedAt} />
                </div>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <button
                  type="button"
                  role="switch"
                  aria-checked={company.enabled}
                  onClick={() => handleToggle(company.id, !company.enabled)}
                  className={cn(
                    "inline-flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors",
                    company.enabled
                      ? "border-foreground/30 bg-foreground text-background"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {company.enabled ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                  {company.enabled ? "Enabled" : "Disabled"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(company.id, company.name)}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={`Remove ${company.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add company form */}
      <div className="space-y-2 border border-dashed border-border p-4">
        <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Add Company</p>
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label>Company name</Label>
            <Input
              placeholder="e.g. Monzo"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Careers page URL</Label>
            <Input
              placeholder="e.g. https://boards.greenhouse.io/monzo"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <p className="text-xs text-muted-foreground">
              Paste the company&apos;s Greenhouse, Lever, or Ashby jobs page URL. ATS type is detected automatically.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={!newName.trim() || !newUrl.trim() || isAdding}
          className="mt-2 w-full sm:w-auto"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {isAdding ? "Adding…" : "Add Company"}
        </Button>
      </div>

      <PresetBrowser trackedUrls={trackedUrls} onAdd={handleAddPreset} />

      {companies.length > 0 && (
        <Button
          type="button"
          variant="outline"
          onClick={handleSyncAll}
          disabled={isSyncing}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing…" : "Sync All Companies"}
        </Button>
      )}
    </div>
  )
}
