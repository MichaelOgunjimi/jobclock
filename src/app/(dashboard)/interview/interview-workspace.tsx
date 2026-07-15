"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QuestionLibrary } from "./question-library"
import { AnswerComposer } from "./answer-composer"
import { AboutMeEditor } from "./about-me-editor"
import { PracticeSession } from "./practice-session"
import { StoryBank } from "./story-bank"
import type {
  InterviewQuestionView,
  InterviewWorkspaceData,
} from "./data"

function ApplicationContextPicker({
  applications,
  value,
  onChange,
}: {
  applications: InterviewWorkspaceData["applications"]
  value: string
  onChange: (value: string) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const selected = applications.find((application) => application.id === value)
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery
    ? applications.filter((application) =>
        `${application.title} ${application.company}`.toLowerCase().includes(normalizedQuery),
      )
    : applications.slice(0, 8)

  return (
    <div className="border border-border bg-card/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.10)] md:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(280px,1.1fr)] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Application context</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={selected ? "outline" : "default"}>
              {selected ? `${selected.title} at ${selected.company}` : "General preparation"}
            </Badge>
            {selected && (
              <button
                type="button"
                onClick={() => onChange("")}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
                Use general prep
              </button>
            )}
          </div>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Pick a role when you want answers and practice feedback to use that job, tailored CV, and saved company research.
          </p>
        </div>

        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="interview-application-context"
              type="search"
              value={query}
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value)
                setOpen(true)
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setOpen(false)
                  setQuery("")
                }
                if (event.key === "Enter" && filtered[0]) {
                  event.preventDefault()
                  onChange(filtered[0].id)
                  setQuery("")
                  setOpen(false)
                }
              }}
              placeholder={applications.length > 0 ? "Search saved applications" : "No saved applications yet"}
              disabled={applications.length === 0}
              className="h-11 w-full border border-border bg-background/85 px-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/25 focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              role="combobox"
              aria-expanded={open}
              aria-controls="interview-application-context-results"
              aria-label="Application context"
            />
          </div>
          {selected && (
            <Link
              href={`/applications/${selected.id}`}
              className="mt-2 inline-flex text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
            >
              Open application
            </Link>
          )}
          {open && applications.length > 0 && (
            <div
              id="interview-application-context-results"
              className="absolute left-0 right-0 z-20 mt-2 max-h-72 overflow-y-auto border border-border bg-background shadow-xl"
            >
              <button
                type="button"
                onClick={() => {
                  onChange("")
                  setQuery("")
                  setOpen(false)
                }}
                className="block w-full border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-secondary"
              >
                General preparation
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Reusable questions and answers across roles
                </span>
              </button>
              {filtered.length > 0 ? (
                filtered.map((application) => (
                  <button
                    key={application.id}
                    type="button"
                    onClick={() => {
                      onChange(application.id)
                      setQuery("")
                      setOpen(false)
                    }}
                    className="block w-full border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-secondary"
                  >
                    {application.title}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {application.company}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                  No matching applications.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ApplicationResearchStatus({
  application,
}: {
  application: InterviewWorkspaceData["applications"][number] | undefined
}) {
  if (!application) return null

  return (
    <div className="border border-border bg-secondary/20 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">
            {application.hasResearch ? "Company research available" : "No company research yet"}
          </p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            {application.hasResearch
              ? "Interview Prep will use saved company research as job context, not as personal evidence."
              : "Interview Prep still works from the job description. Create research on the application page when you want company-specific coaching."}
          </p>
        </div>
        <Link
          href={`/applications/${application.id}`}
          className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
        >
          {application.hasResearch ? "View or refresh" : "Create research"}
        </Link>
      </div>
    </div>
  )
}

export function InterviewWorkspace({
  initial,
}: {
  initial: InterviewWorkspaceData
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [questions, setQuestions] = useState(initial.questions)
  const [applicationId, setApplicationId] = useState(initial.selectedApplicationId ?? "")
  const visibleQuestions = useMemo(
    () =>
      questions.filter((question) =>
        applicationId ? !question.applicationId || question.applicationId === applicationId : !question.applicationId,
      ),
    [applicationId, questions],
  )
  const [selectedKey, setSelectedKey] = useState<string | null>(
    visibleQuestions[0]?.key ?? null,
  )
  const selected = useMemo(
    () =>
      visibleQuestions.find((question) => question.key === selectedKey) ??
      visibleQuestions[0] ??
      null,
    [selectedKey, visibleQuestions],
  )
  const selectedApplication = initial.applications.find((application) => application.id === applicationId)

  function changeApplicationContext(nextApplicationId: string) {
    setApplicationId(nextApplicationId)
    const params = new URLSearchParams(searchParams.toString())
    if (nextApplicationId) {
      params.set("applicationId", nextApplicationId)
    } else {
      params.delete("applicationId")
    }
    const query = params.toString()
    router.replace(query ? `/interview?${query}` : "/interview", { scroll: false })
  }

  function addQuestion(question: InterviewQuestionView) {
    setQuestions((current) => [question, ...current])
    setSelectedKey(question.key)
  }

  function persistQuestion(key: string, id: string) {
    setQuestions((current) =>
      current.map((question) =>
        question.key === key ? { ...question, id } : question,
      ),
    )
  }

  return (
    <div className="space-y-5">
      {initial.applicationContextError && (
        <div className="border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          {initial.applicationContextError}
        </div>
      )}

      <ApplicationContextPicker
        applications={initial.applications}
        value={applicationId}
        onChange={changeApplicationContext}
      />
      <ApplicationResearchStatus application={selectedApplication} />

      <Tabs defaultValue="questions">
        <TabsList className="mb-4 gap-1 overflow-x-auto border-b-0 bg-secondary/25 p-1">
          <TabsTrigger className="px-3.5 py-2 data-[active]:bg-background" value="questions">Questions</TabsTrigger>
          <TabsTrigger className="px-3.5 py-2 data-[active]:bg-background" value="practice">Grill Me</TabsTrigger>
          <TabsTrigger className="px-3.5 py-2 data-[active]:bg-background" value="stories">Story Bank</TabsTrigger>
          <TabsTrigger className="px-3.5 py-2 data-[active]:bg-background" value="about">About Me</TabsTrigger>
        </TabsList>

      <TabsContent value="questions">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          <QuestionLibrary
            questions={visibleQuestions}
            selectedKey={selected?.key ?? null}
            onSelect={(question) => setSelectedKey(question.key)}
            onCreated={addQuestion}
          />
          {selected ? (
            <AnswerComposer
              question={selected}
              answers={initial.answers}
              applications={initial.applications}
              applicationId={applicationId}
              facts={initial.facts}
              applicationCvFactDrafts={initial.applicationCvFactDrafts}
              onQuestionPersisted={persistQuestion}
            />
          ) : (
            <div className="border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              Add or choose a question to begin.
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="practice">
        <PracticeSession
          questions={visibleQuestions}
          answers={initial.answers}
          applications={initial.applications}
          applicationId={applicationId}
        />
      </TabsContent>

      <TabsContent value="stories">
        <StoryBank initial={initial.stories} />
      </TabsContent>

      <TabsContent value="about">
        <AboutMeEditor
          facts={initial.facts}
          cvFactDrafts={initial.cvFactDrafts}
        />
      </TabsContent>
      </Tabs>
    </div>
  )
}
