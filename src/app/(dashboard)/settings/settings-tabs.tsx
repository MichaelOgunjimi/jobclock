"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TagInput } from "@/components/ui/tag-input"
import { Check, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { AiSettingsForm } from "./ai-settings-form"
import { ExtensionSettingsCard } from "./extension-settings-card"
import { TemplatePicker } from "./template-picker"
import { JobSourcesForm } from "./job-sources-form"
import { TrackedCompaniesForm } from "./tracked-companies-form"
import { savePreferences } from "../profile/actions"
import type { AiSettings, JobSources } from "@/lib/ai"
import type { PersonalApiTokenMetadata } from "@/lib/personal-api-tokens"
import type { TrackedCompany } from "./actions"

type KeyStatus = { anthropic: "saved" | "env" | "none"; openai: "saved" | "env" | "none"; perplexity: "saved" | "env" | "none" }

const EXPERIENCE_LEVELS = [
  { value: "graduate", label: "Graduate / Entry Level" },
  { value: "junior", label: "Junior (1–3 yrs)" },
  { value: "mid", label: "Mid (3–5 yrs)" },
  { value: "senior", label: "Senior (5+ yrs)" },
] as const

type ProfilePrefs = {
  desired_roles: string[] | null
  locations_uk: string[] | null
  target_salary_min: number | null
  right_to_work_uk: boolean | null
  experience_level: string[] | null
}

const CV_TEMPLATES = [
  { value: "classic", label: "Classic", description: "Harvard-style serif layout with ruled section headers." },
  { value: "modern", label: "Modern", description: "Clean sans-serif layout with bottom-border section headings." },
  { value: "minimal", label: "Minimal", description: "Light hairline dividers and uppercase labels — maximum whitespace." },
  { value: "bold", label: "Bold", description: "Strong inline accent bars on section headings for visual impact." },
  { value: "compact", label: "Compact", description: "Dense uppercase-label style that fits more content per page." },
  { value: "sidebar", label: "Sidebar", description: "Two-column layout with a dark left rail for skills and contact." },
  { value: "professional", label: "Professional", description: "Heavy black underline headers with a formal, structured feel." },
]

const COVER_LETTER_TEMPLATES = [
  { value: "classic", label: "Classic", description: "Formal business letter format with left-aligned sender block." },
  { value: "modern", label: "Modern", description: "Concise sans-serif layout with a bold header bar and direct tone." },
  { value: "elegant", label: "Elegant", description: "Centered serif header with refined spacing for a polished feel." },
  { value: "professional", label: "Professional", description: "Centered serif name with contact bar — traditional and authoritative." },
]

export function SettingsTabs({
  aiSettings,
  keyStatus,
  preferredCvTemplate,
  preferredCoverLetterTemplate,
  jobSources,
  extensionToken,
  profilePrefs,
  trackedCompanies,
}: {
  aiSettings: AiSettings
  keyStatus: KeyStatus
  preferredCvTemplate: string
  preferredCoverLetterTemplate: string
  jobSources: JobSources
  extensionToken: PersonalApiTokenMetadata | null
  profilePrefs: ProfilePrefs
  trackedCompanies: TrackedCompany[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const validTabs = ["ai", "appearance", "extension", "job-search", "job-sources", "companies"]
  const activeTab = validTabs.includes(searchParams.get("tab") ?? "") ? searchParams.get("tab")! : "ai"

  const [roles, setRoles] = useState<string[]>(profilePrefs.desired_roles ?? [])
  const [locations, setLocations] = useState<string[]>(profilePrefs.locations_uk ?? [])
  const [salary, setSalary] = useState(profilePrefs.target_salary_min?.toString() ?? "")
  const [rightToWork, setRightToWork] = useState(profilePrefs.right_to_work_uk ?? false)
  const [experienceLevels, setExperienceLevels] = useState<string[]>(profilePrefs.experience_level ?? [])
  const [isPending, startTransition] = useTransition()
  const [savedPrefs, setSavedPrefs] = useState({ roles, locations, salary, rightToWork, experienceLevels })

  const isDirty =
    JSON.stringify(roles) !== JSON.stringify(savedPrefs.roles) ||
    JSON.stringify(locations) !== JSON.stringify(savedPrefs.locations) ||
    salary !== savedPrefs.salary ||
    rightToWork !== savedPrefs.rightToWork ||
    JSON.stringify(experienceLevels) !== JSON.stringify(savedPrefs.experienceLevels)

  function handleSavePreferences() {
    if (!isDirty) return
    startTransition(async () => {
      const result = await savePreferences({
        desiredRoles: roles,
        locationsUk: locations,
        targetSalaryMin: salary ? Number(salary) : null,
        rightToWorkUk: rightToWork,
        experienceLevel: experienceLevels,
      })
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success("Preferences saved")
        setSavedPrefs({ roles, locations, salary, rightToWork, experienceLevels })
      }
    })
  }

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.replace(`/settings?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-6 shrink-0 gap-1 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mb-8">
        <TabsTrigger value="ai" className="shrink-0 px-2.5 sm:px-4">AI</TabsTrigger>
        <TabsTrigger value="appearance" className="shrink-0 px-2.5 sm:px-4">Appearance</TabsTrigger>
        <TabsTrigger value="extension" className="shrink-0 px-2.5 sm:px-4">Extension</TabsTrigger>
        <TabsTrigger value="job-search" className="shrink-0 px-2.5 sm:px-4">Job Search</TabsTrigger>
        <TabsTrigger value="job-sources" className="shrink-0 px-2.5 sm:px-4">Job Sources</TabsTrigger>
        <TabsTrigger value="companies" className="shrink-0 px-2.5 sm:px-4">Companies</TabsTrigger>
      </TabsList>

      {/* AI Tab */}
      <TabsContent value="ai">
        <Card>
          <CardHeader className="border-b pb-6">
            <p className="section-label">AI</p>
            <CardTitle>Provider & Model</CardTitle>
            <CardDescription>
              Choose the provider and model for assistant features, then add your own API key for generation.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <AiSettingsForm current={aiSettings} keyStatus={keyStatus} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Appearance Tab */}
      <TabsContent value="appearance">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b pb-6">
              <p className="section-label">Appearance</p>
              <CardTitle>CV Layout</CardTitle>
              <CardDescription>
                Choose the layout used when you preview and print your tailored CV. You can also change it directly on the CV preview page.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <TemplatePicker
                type="cv"
                current={preferredCvTemplate}
                options={CV_TEMPLATES}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-6">
              <p className="section-label">Appearance</p>
              <CardTitle>Cover Letter Layout</CardTitle>
              <CardDescription>
                Choose the visual layout used when generating and exporting your cover letters.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <TemplatePicker
                type="cover_letter"
                current={preferredCoverLetterTemplate}
                options={COVER_LETTER_TEMPLATES}
              />
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="extension">
        <ExtensionSettingsCard initialToken={extensionToken} />
      </TabsContent>

      {/* Job Search Tab */}
      <TabsContent value="job-search">
        <Card>
          <CardHeader className="border-b pb-6">
            <p className="section-label">Job Search</p>
            <CardTitle>Search Preferences</CardTitle>
            <CardDescription>
              Configure filters used when searching for jobs. These also apply to Adzuna and Reed results.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Target Roles</Label>
                  <TagInput
                    value={roles}
                    onChange={setRoles}
                    placeholder="Type a role and press Enter…"
                  />
                  <p className="text-xs text-muted-foreground">Press Enter or comma to add each role</p>
                </div>
                <div className="space-y-2">
                  <Label>Preferred Locations</Label>
                  <TagInput
                    value={locations}
                    onChange={setLocations}
                    placeholder="Type a city and press Enter…"
                  />
                  <p className="text-xs text-muted-foreground">e.g. London, Manchester, Remote</p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Experience Level</Label>
                  <div className="flex flex-wrap gap-2">
                    {EXPERIENCE_LEVELS.map((level) => {
                      const active = experienceLevels.includes(level.value)
                      return (
                        <button
                          key={level.value}
                          type="button"
                          onClick={() =>
                            setExperienceLevels((prev) =>
                              active ? prev.filter((v) => v !== level.value) : [...prev, level.value]
                            )
                          }
                          className={cn(
                            "border px-4 py-2 text-sm font-medium transition-colors",
                            active
                              ? "border-foreground bg-foreground text-background"
                              : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {level.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Minimum Salary (£)</Label>
                  <Input
                    type="number"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    placeholder="30000"
                  />
                </div>
                <div className="space-y-2">
                  <Label id="right-to-work-label">Right to Work UK</Label>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={rightToWork}
                    aria-labelledby="right-to-work-label"
                    onClick={() => setRightToWork((v) => !v)}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 border px-4 py-3 text-left transition-colors",
                      rightToWork
                        ? "border-foreground/15 bg-secondary text-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center border transition-colors",
                        rightToWork
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-secondary text-transparent"
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 space-y-1">
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                        Right to work confirmed
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        I have the right to work in the UK
                      </span>
                    </span>
                  </button>
                </div>
              </div>
              <Button onClick={handleSavePreferences} disabled={!isDirty || isPending} className="min-w-44">
                {isPending ? "Saving…" : "Save Preferences"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Job Sources Tab */}
      <TabsContent value="job-sources">
        <Card>
          <CardHeader className="border-b pb-6">
            <p className="section-label">Jobs</p>
            <CardTitle>Job Sources</CardTitle>
            <CardDescription>
              Configure where the assistant searches for jobs.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <JobSourcesForm initial={jobSources} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tracked Companies Tab */}
      <TabsContent value="companies">
        <Card>
          <CardHeader className="border-b pb-6">
            <p className="section-label">Jobs</p>
            <CardTitle>Tracked Companies</CardTitle>
            <CardDescription>
              Add companies whose careers pages you want to monitor. Jobs are synced directly from Greenhouse, Lever, and Ashby boards and appear in your job feed.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <TrackedCompaniesForm initial={trackedCompanies} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
