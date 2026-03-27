"use client"

import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FileText, Star } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { CvCardActions } from "./cv-card-actions"
import { CvUploadDialog } from "./cv-upload-dialog"
import { CoverLettersTab } from "./cover-letters-tab"
import { savePreferences } from "./actions"
import type { CvData } from "@/lib/supabase/database.types"

type CvRow = {
  id: string
  name: string | null
  is_primary: boolean | null
  created_at: string
  parsed_json: unknown
}

type LetterTemplate = {
  id: string
  label: string | null
  content: string
  tone: "professional" | "enthusiastic" | "conservative" | null
}

type ProfileData = {
  desired_roles: string[] | null
  location_uk: string | null
  target_salary_min: number | null
  right_to_work_uk: boolean | null
} | null

export function ProfileTabs({
  cvs,
  coverLetters,
  profile,
}: {
  cvs: CvRow[]
  coverLetters: LetterTemplate[]
  profile: ProfileData
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const validTabs = ["cvs", "cover-letters", "preferences"]
  const activeTab = validTabs.includes(searchParams.get("tab") ?? "") ? searchParams.get("tab")! : "cvs"

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.replace(`/profile?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-8">
        <TabsTrigger value="cvs">CVs</TabsTrigger>
        <TabsTrigger value="cover-letters">Cover Letters</TabsTrigger>
        <TabsTrigger value="preferences">Preferences</TabsTrigger>
      </TabsList>

      {/* CVs Tab */}
      <TabsContent value="cvs">
        <div className="flex justify-end mb-4">
          <CvUploadDialog />
        </div>
        {cvs.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cvs.map((cv) => {
              const parsed = cv.parsed_json as CvData | null
              const label = cv.name ?? parsed?.name ?? "Untitled CV"
              const skills = parsed?.skills?.slice(0, 4) ?? []
              const expCount = parsed?.experience?.length ?? 0
              return (
                <div key={cv.id} className="group relative flex flex-col border border-border bg-card transition-colors hover:border-foreground/30">
                  <Link href={`/profile/${cv.id}`} className="flex flex-1 flex-col p-5 gap-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex size-9 shrink-0 items-center justify-center border border-border bg-secondary">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">{label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(cv.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      {cv.is_primary && (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          <Star className="h-2.5 w-2.5 mr-1" />
                          Primary
                        </Badge>
                      )}
                    </div>
                    {skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {skills.map((s) => (
                          <span key={s} className="border border-border bg-secondary px-1.5 py-0.5 text-[10px] tracking-wide text-muted-foreground uppercase">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-auto">
                      {expCount} experience {expCount === 1 ? "entry" : "entries"}
                    </p>
                  </Link>
                  <CvCardActions cvId={cv.id} isPrimary={cv.is_primary ?? false} />
                </div>
              )
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-14 text-center text-muted-foreground">
              <FileText className="mx-auto mb-4 h-10 w-10 opacity-30" />
              <p className="text-sm">No CVs yet. Upload your first one to get started.</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Cover Letters Tab */}
      <TabsContent value="cover-letters">
        <CoverLettersTab initialLetters={coverLetters} />
      </TabsContent>

      {/* Preferences Tab */}
      <TabsContent value="preferences">
        <div>
          <Card>
            <CardContent className="pt-6">
              <form action={savePreferences as unknown as (formData: FormData) => void} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Target Roles</Label>
                    <Input
                      name="desired_roles"
                      defaultValue={profile?.desired_roles?.join(", ") ?? ""}
                      placeholder="Software Engineer, Developer…"
                    />
                    <p className="text-xs text-muted-foreground">Comma-separated</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input
                      name="location_uk"
                      defaultValue={profile?.location_uk ?? ""}
                      placeholder="London, UK"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Minimum Salary (£)</Label>
                    <Input
                      name="target_salary_min"
                      type="number"
                      defaultValue={profile?.target_salary_min ?? ""}
                      placeholder="30000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Right to Work UK</Label>
                    <div className="flex items-center gap-2 h-11">
                      <input
                        type="checkbox"
                        name="right_to_work_uk"
                        defaultChecked={profile?.right_to_work_uk ?? false}
                        className="h-4 w-4"
                      />
                      <span className="text-sm">I have the right to work in the UK</span>
                    </div>
                  </div>
                </div>
                <Button type="submit" variant="outline">Save Preferences</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  )
}
