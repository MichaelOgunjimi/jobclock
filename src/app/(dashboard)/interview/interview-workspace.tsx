"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CircleHelp, Search, X } from "lucide-react"
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
    <div className="border border-border bg-card/80 p-4 shadow-[0_14px_45px_rgba(0,0,0,0.07)] md:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Application context
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
              {selected ? `${selected.title} at ${selected.company}` : "General preparation"}
            </span>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Search applications</p>
            </div>
            {selected && (
              <Link
                href={`/applications/${selected.slug}`}
                className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
              >
                Open application
              </Link>
            )}
          </div>

          <div className="relative mt-2">
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
            <div className="mt-3 border border-border bg-secondary/25 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {selected.hasResearch ? "Company research available" : "Company research missing"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {selected.hasResearch
                      ? "Interview Prep can use saved company research as role context."
                      : "You can still practise from the job description. Add research from the application page when needed."}
                  </p>
                </div>
                <Link
                  href={`/applications/${selected.slug}`}
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
                >
                  {selected.hasResearch ? "View research" : "Add research"}
                </Link>
              </div>
            </div>
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

  function changeApplicationContext(nextApplicationId: string) {
    setApplicationId(nextApplicationId)
    const params = new URLSearchParams(searchParams.toString())
    if (nextApplicationId) {
      const application = initial.applications.find((item) => item.id === nextApplicationId)
      params.set("application", application?.slug ?? nextApplicationId)
      params.delete("applicationId")
    } else {
      params.delete("application")
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

      <Tabs defaultValue="questions">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList className="gap-1 overflow-x-auto border-b-0 bg-secondary/25 p-1">
            <TabsTrigger className="px-3.5 py-2 data-[active]:bg-background" value="questions">Questions</TabsTrigger>
            <TabsTrigger className="px-3.5 py-2 data-[active]:bg-background" value="practice">Grill Me</TabsTrigger>
            <TabsTrigger className="px-3.5 py-2 data-[active]:bg-background" value="stories">Story Bank</TabsTrigger>
            <TabsTrigger className="px-3.5 py-2 data-[active]:bg-background" value="about">About Me</TabsTrigger>
          </TabsList>

          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 border border-border bg-card px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground">
              <CircleHelp className="size-3.5" />
              How to use this
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-[min(360px,calc(100vw-2rem))] border border-border bg-background p-4 text-sm shadow-xl">
              <p className="font-semibold text-foreground">Interview prep flow</p>
              <ol className="mt-3 space-y-2 text-muted-foreground">
                <li><span className="font-semibold text-foreground">1.</span> Stay in general mode for reusable answers, or search a job to tailor the page.</li>
                <li><span className="font-semibold text-foreground">2.</span> Pick a question on the left, then generate or write a full answer on the right.</li>
                <li><span className="font-semibold text-foreground">3.</span> Confirm facts or stories when the app asks for evidence, then save the answer.</li>
                <li><span className="font-semibold text-foreground">4.</span> Use Grill Me to type a practice answer and get feedback against the saved version.</li>
              </ol>
            </div>
          </details>
        </div>

      <TabsContent value="questions">
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
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
          applicationCvFactDrafts={initial.applicationCvFactDrafts}
          applicationId={applicationId}
          applications={initial.applications}
        />
      </TabsContent>
      </Tabs>
    </div>
  )
}
