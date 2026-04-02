"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AiSettingsForm } from "./ai-settings-form"
import { TemplatePicker } from "./template-picker"
import { JobSourcesForm } from "./job-sources-form"
import type { AiSettings, JobSources } from "@/lib/ai"

type KeyStatus = { anthropic: "saved" | "env" | "none"; openai: "saved" | "env" | "none" }

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
}: {
  aiSettings: AiSettings
  keyStatus: KeyStatus
  preferredCvTemplate: string
  preferredCoverLetterTemplate: string
  jobSources: JobSources
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const validTabs = ["ai", "documents", "job-sources"]
  const activeTab = validTabs.includes(searchParams.get("tab") ?? "") ? searchParams.get("tab")! : "ai"

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.replace(`/settings?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-6 shrink-0 gap-1 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mb-8">
        <TabsTrigger value="ai" className="shrink-0 px-2.5 sm:px-4">AI</TabsTrigger>
        <TabsTrigger value="documents" className="shrink-0 px-2.5 sm:px-4">Documents</TabsTrigger>
        <TabsTrigger value="job-sources" className="shrink-0 px-2.5 sm:px-4">Job Sources</TabsTrigger>
      </TabsList>

      {/* AI Tab */}
      <TabsContent value="ai">
        <Card>
          <CardHeader className="border-b pb-6">
            <p className="section-label">AI</p>
            <CardTitle>Provider & Model</CardTitle>
            <CardDescription>
              Select which AI provider and model powers the assistant features.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <AiSettingsForm current={aiSettings} keyStatus={keyStatus} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Documents Tab */}
      <TabsContent value="documents">
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b pb-6">
              <p className="section-label">Documents</p>
              <CardTitle>CV Template</CardTitle>
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
              <p className="section-label">Documents</p>
              <CardTitle>Cover Letter Template</CardTitle>
              <CardDescription>
                Choose the tone and structure used when generating your cover letters.
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

      {/* Job Sources Tab */}
      <TabsContent value="job-sources">
        <Card>
          <CardHeader className="border-b pb-6">
            <p className="section-label">Jobs</p>
            <CardTitle>Job Sources</CardTitle>
            <CardDescription>
              Configure where the assistant searches for jobs. Filters (roles, locations, salary) come from your Profile preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <JobSourcesForm initial={jobSources} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
