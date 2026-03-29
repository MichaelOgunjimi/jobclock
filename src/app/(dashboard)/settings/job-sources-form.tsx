"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Plus, Trash2, Globe, ToggleLeft, ToggleRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { saveJobSources } from "./actions"
import type { JobSources, JobSourceCustomUrl } from "@/lib/ai"

function SourceToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors",
        enabled
          ? "border-foreground/30 bg-foreground text-background"
          : "border-border bg-secondary text-muted-foreground hover:text-foreground"
      )}
    >
      {enabled ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
      {enabled ? "Enabled" : "Disabled"}
    </button>
  )
}

export function JobSourcesForm({ initial }: { initial: JobSources }) {
  const [adzunaEnabled, setAdzunaEnabled] = useState(initial.adzuna?.enabled ?? true)
  const [reedEnabled, setReedEnabled] = useState(initial.reed?.enabled ?? false)
  const [reedKey, setReedKey] = useState(initial.reed?.api_key ?? "")
  const [customUrls, setCustomUrls] = useState<JobSourceCustomUrl[]>(initial.custom ?? [])
  const [newLabel, setNewLabel] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const [isPending, startTransition] = useTransition()
  const [savedSources, setSavedSources] = useState({
    adzunaEnabled: initial.adzuna?.enabled ?? true,
    reedEnabled: initial.reed?.enabled ?? false,
    reedKey: initial.reed?.api_key ?? "",
    customUrls: initial.custom ?? [] as JobSourceCustomUrl[],
  })

  const isDirty =
    adzunaEnabled !== savedSources.adzunaEnabled ||
    reedEnabled !== savedSources.reedEnabled ||
    reedKey !== savedSources.reedKey ||
    JSON.stringify(customUrls) !== JSON.stringify(savedSources.customUrls)

  function addCustomUrl() {
    const label = newLabel.trim()
    const url = newUrl.trim()
    if (!label || !url) return
    try { new URL(url) } catch { toast.error("Invalid URL"); return }
    const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setCustomUrls((prev) => [...prev, { id, label, url, enabled: true }])
    setNewLabel("")
    setNewUrl("")
  }

  function removeCustomUrl(id: string) {
    setCustomUrls((prev) => prev.filter((u) => u.id !== id))
  }

  function toggleCustomUrl(id: string) {
    setCustomUrls((prev) => prev.map((u) => u.id === id ? { ...u, enabled: !u.enabled } : u))
  }

  function handleSave() {
    if (!isDirty) return
    startTransition(async () => {
      const result = await saveJobSources({
        adzuna: { enabled: adzunaEnabled },
        reed: { enabled: reedEnabled, api_key: reedKey || undefined },
        custom: customUrls,
      })
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Job sources saved")
        setSavedSources({ adzunaEnabled, reedEnabled, reedKey, customUrls })
      }
    })
  }

  return (
    <div className="space-y-8">

      {/* Adzuna */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Adzuna</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              UK job board aggregator — uses your <code className="text-xs">ADZUNA_APP_ID</code> and <code className="text-xs">ADZUNA_APP_KEY</code> env vars
            </p>
          </div>
          <SourceToggle enabled={adzunaEnabled} onToggle={() => setAdzunaEnabled((v) => !v)} />
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Reed */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Reed</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              UK&apos;s largest job board — free API key at{" "}
              <span className="text-foreground">reed.co.uk/developers</span>
            </p>
          </div>
          <SourceToggle enabled={reedEnabled} onToggle={() => setReedEnabled((v) => !v)} />
        </div>
        {reedEnabled && (
          <div className="space-y-2 pl-0">
            <Label>Reed API Key</Label>
            <Input
              type="password"
              value={reedKey}
              onChange={(e) => setReedKey(e.target.value)}
              placeholder="Enter your Reed API key"
            />
          </div>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Custom URLs */}
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">Custom Job Board URLs</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paste any job board search URL — apply your own filters directly in the URL (role, location, salary). We scrape it on schedule
          </p>
        </div>

        {customUrls.length > 0 && (
          <div className="space-y-2">
            {customUrls.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 border border-border bg-secondary px-4 py-3"
              >
                <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.url}</p>
                </div>
                <SourceToggle enabled={item.enabled} onToggle={() => toggleCustomUrl(item.id)} />
                <button
                  type="button"
                  onClick={() => removeCustomUrl(item.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 border border-dashed border-border p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Add URL</p>
          <div className="space-y-2">
            <Input
              placeholder="Label — e.g. TotalJobs Senior Dev London"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <Input
              placeholder="e.g. https://www.totaljobs.com/jobs/software-engineer/in-london"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomUrl()}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustomUrl}
            disabled={!newLabel.trim() || !newUrl.trim()}
            className="mt-2"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add
          </Button>
        </div>
      </div>

      <Button onClick={handleSave} disabled={!isDirty || isPending}>
        {isPending ? "Saving…" : "Save Job Sources"}
      </Button>
    </div>
  )
}
