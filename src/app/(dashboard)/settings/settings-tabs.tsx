"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AiSettingsForm } from "./ai-settings-form"
import { TemplateUpload } from "./template-upload"
import type { AiSettings } from "@/lib/ai"

type KeyStatus = { anthropic: "saved" | "env" | "none"; openai: "saved" | "env" | "none" }

export function SettingsTabs({
  aiSettings,
  keyStatus,
  hasCvTemplate,
  hasCoverLetterTemplate,
}: {
  aiSettings: AiSettings
  keyStatus: KeyStatus
  hasCvTemplate: boolean
  hasCoverLetterTemplate: boolean
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
      <TabsList className="mb-8 shrink-0">
        <TabsTrigger value="ai">AI</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
        <TabsTrigger value="job-sources">Job Sources</TabsTrigger>
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
                Upload your CV layout as a DOCX file. We convert it to HTML and use it to generate your tailored CV PDFs.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <TemplateUpload type="cv" hasExisting={hasCvTemplate} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b pb-6">
              <p className="section-label">Documents</p>
              <CardTitle>Cover Letter Template</CardTitle>
              <CardDescription>
                Upload your cover letter layout as a DOCX file. Used to generate formatted cover letter PDFs for each application.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <TemplateUpload type="cover_letter" hasExisting={hasCoverLetterTemplate} />
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
              Configure where the assistant searches for jobs matching your preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="py-10 text-center text-muted-foreground">
              <p className="text-sm">Job sources configuration coming soon.</p>
              <p className="text-xs mt-1 opacity-60">You&apos;ll be able to add Reed API, LinkedIn, and custom job board URLs here.</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
