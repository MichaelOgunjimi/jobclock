"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useGenerationJobsContext } from "@/contexts/generation-jobs-context"
import Link from "next/link"
import {
  ArrowLeft,
  BookOpen,
  Check,
  Download,
  ExternalLink,
  Loader2,
  Maximize2,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-styles"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MarkdownContent } from "@/components/ui/markdown-content"
import { GenerationProgress } from "@/components/generation-progress"
import { cn } from "@/lib/utils"
import {
  updateStatus,
  updateNotes,
  updateCv,
  updateWritingStyle,
  updateDescription,
  updateJobDetail,
  deleteApplication,
  generateCoverLetter,
} from "./actions"
import { FollowUpCard } from "./follow-up-card"
import { useDownloadPdf } from "@/hooks/use-download-pdf"
import { buildCoverLetterFilenameBase } from "@/lib/document-filename"
import type { ApplicationStatus, Database, WritingStyle } from "@/lib/supabase/database.types"
import { applicationPath } from "@/lib/applications/path"

type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"]
type JobsCacheRow = Database["public"]["Tables"]["jobs_cache"]["Row"]
type UserCvRow = Pick<
  Database["public"]["Tables"]["user_cvs"]["Row"],
  "id" | "name" | "is_primary" | "created_at"
>
type WritingStyleRow = Pick<WritingStyle, "id" | "label" | "default_tone" | "is_built_in">
type TailoredCvRow = Pick<
  Database["public"]["Tables"]["customized_cvs"]["Row"],
  "id" | "cv_json" | "skills_gap" | "ats_score" | "created_at"
>
type GeneratedCoverLetterRow = Pick<
  Database["public"]["Tables"]["cover_letters"]["Row"],
  "id" | "content" | "tone" | "label" | "created_at"
>
interface ApplicationWithJob extends ApplicationRow {
  jobs_cache: JobsCacheRow | null
}

interface Props {
  application: ApplicationWithJob
  cvs: UserCvRow[]
  writingStyles: WritingStyleRow[]
  tailoredCvs: TailoredCvRow[]
  generatedCoverLetter: GeneratedCoverLetterRow | null
  followUpDueAt: string | null
  followUpNotes: string | null
}

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_STEPS: { value: ApplicationStatus; label: string; num: string }[] =
  [
    { value: "saved", label: "Saved", num: "01" },
    { value: "applied", label: "Applied", num: "02" },
    { value: "screening", label: "Screening", num: "03" },
    { value: "interview", label: "Interview", num: "04" },
    { value: "offer", label: "Offer", num: "05" },
  ]

function getStatusBadgeClass(status: ApplicationStatus): string {
  switch (status) {
    case "saved":
      return "border-border bg-secondary text-foreground"
    case "applied":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
    case "screening":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
    case "interview":
      return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300"
    case "offer":
      return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
    case "rejected":
      return "border-destructive/20 bg-destructive/10 text-destructive"
    case "withdrawn":
      return "border-border bg-secondary text-muted-foreground opacity-70"
    case "ghosted":
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300"
    default:
      return "border-border bg-secondary text-foreground"
  }
}

function getStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case "saved":
      return "Saved"
    case "applied":
      return "Applied"
    case "screening":
      return "Screening"
    case "interview":
      return "Interview"
    case "offer":
      return "Offer"
    case "rejected":
      return "Rejected"
    case "withdrawn":
      return "Withdrawn"
    case "ghosted":
      return "Ghosted"
    default:
      return status
  }
}

function getAtsBadgeClass(score: number): string {
  if (score >= 75)
    return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
  if (score >= 50)
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
  return "border-destructive/20 bg-destructive/10 text-destructive"
}

// ── Skills gap helper ────────────────────────────────────────────────────────

function parseSkillsGap(raw: unknown): { gap: string[]; changes: string | null } {
  if (!raw) return { gap: [], changes: null }
  if (Array.isArray(raw)) return { gap: raw as string[], changes: null }
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as { gap?: string[]; changes?: string }
    return { gap: obj.gap ?? [], changes: obj.changes ?? null }
  }
  return { gap: [], changes: null }
}


// ── Pipeline stepper ────────────────────────────────────────────────────────

export function StatusStepper({
  currentStatus,
  applicationId,
}: {
  currentStatus: ApplicationStatus
  applicationId: string
}) {
  const [pending, startTransition] = useTransition()
  const [pendingStatus, setPendingStatus] = useState<ApplicationStatus | null>(null)
  const isTerminal =
    currentStatus === "rejected" || currentStatus === "withdrawn" || currentStatus === "ghosted"
  const currentIndex = STATUS_STEPS.findIndex((s) => s.value === currentStatus)
  function handleStatusClick(status: ApplicationStatus) {
    if (status === currentStatus || pending) return
    const formData = new FormData()
    formData.set("applicationId", applicationId)
    formData.set("status", status)
    setPendingStatus(status)
    startTransition(async () => {
      try {
        await updateStatus(formData)
      } finally {
        setPendingStatus(null)
      }
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Click any stage to move this application forward or back. Outcomes stay available below.
      </p>
      <div className="grid gap-2 sm:hidden">
        {STATUS_STEPS.map((step, index) => {
          const isPast = !isTerminal && index < currentIndex
          const isCurrent = !isTerminal && index === currentIndex
          const isFuture = isTerminal || index > currentIndex

          return (
            <button
              key={step.value}
              type="button"
              disabled={pending || step.value === currentStatus}
              onClick={() => handleStatusClick(step.value)}
              aria-label={pendingStatus === step.value ? `Updating ${step.label}` : step.label}
              className={cn(
                "flex items-center justify-between border px-4 py-3 transition-colors",
                "cursor-pointer hover:ring-2 hover:ring-foreground/20",
                isCurrent &&
                  "border-foreground bg-foreground text-background",
                isPast &&
                  "border-foreground/30 bg-secondary/60 text-foreground",
                isFuture && "border-border bg-background text-muted-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold tracking-[0.1em] opacity-60">
                  {step.num}
                </span>
                <span className="text-[11px] font-semibold tracking-[0.06em] uppercase">
                  {step.label}
                </span>
                {pendingStatus === step.value && (
                  <Loader2 role="status" aria-label={`Updating ${step.label}`} className="h-3.5 w-3.5 animate-spin" />
                )}
              </div>
              {isCurrent && <span className="text-[10px] font-semibold tracking-[0.1em] uppercase">current</span>}
            </button>
          )
        })}
      </div>

      <div className="hidden items-stretch gap-0 sm:flex">
        {STATUS_STEPS.map((step, index) => {
          const isPast = !isTerminal && index < currentIndex
          const isCurrent = !isTerminal && index === currentIndex
          const isFuture = isTerminal || index > currentIndex

          return (
            <button
              key={step.value}
              type="button"
              disabled={pending || step.value === currentStatus}
              onClick={() => handleStatusClick(step.value)}
              aria-label={pendingStatus === step.value ? `Updating ${step.label}` : step.label}
              className={cn(
                "flex flex-1 flex-col gap-1.5 border px-3 py-3 text-center transition-colors",
                index !== 0 && "-ml-px",
                "cursor-pointer hover:ring-2 hover:ring-foreground/20",
                isCurrent &&
                  "relative z-10 border-foreground bg-foreground text-background",
                isPast &&
                  "border-foreground/30 bg-secondary/60 text-foreground",
                isFuture && "border-border bg-background text-muted-foreground"
              )}
            >
              <span className="text-[10px] font-semibold tracking-[0.1em] opacity-60">
                {step.num}
              </span>
              <span className="inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] uppercase">
                {step.label}
                {pendingStatus === step.value && (
                  <Loader2 role="status" aria-label={`Updating ${step.label}`} className="h-3.5 w-3.5 animate-spin" />
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-2 mt-2 sm:hidden">
        <button
          type="button"
          onClick={() => handleStatusClick("rejected")}
          disabled={pending}
          aria-label={pendingStatus === "rejected" ? "Updating Rejected" : "Rejected"}
          className={cn(
            "px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] border transition-colors cursor-pointer",
            currentStatus === "rejected"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-background text-muted-foreground hover:ring-2 hover:ring-foreground/20",
            pending && "opacity-60"
          )}
        >
          {pendingStatus === "rejected" && <Loader2 role="status" aria-label="Updating Rejected" className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />}
          Rejected
        </button>
        <button
          type="button"
          onClick={() => handleStatusClick("withdrawn")}
          disabled={pending}
          aria-label={pendingStatus === "withdrawn" ? "Updating Withdrawn" : "Withdrawn"}
          className={cn(
            "px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] border transition-colors cursor-pointer",
            currentStatus === "withdrawn"
              ? "border-border bg-secondary text-muted-foreground"
              : "border-border bg-background text-muted-foreground hover:ring-2 hover:ring-foreground/20",
            pending && "opacity-60"
          )}
        >
          {pendingStatus === "withdrawn" && <Loader2 role="status" aria-label="Updating Withdrawn" className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />}
          Withdrawn
        </button>
        <button
          type="button"
          onClick={() => handleStatusClick("ghosted")}
          disabled={pending}
          aria-label={pendingStatus === "ghosted" ? "Updating Ghosted" : "Ghosted"}
          className={cn(
            "px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] border transition-colors cursor-pointer",
            currentStatus === "ghosted"
              ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300"
              : "border-border bg-background text-muted-foreground hover:ring-2 hover:ring-foreground/20",
            pending && "opacity-60"
          )}
        >
          {pendingStatus === "ghosted" && <Loader2 role="status" aria-label="Updating Ghosted" className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />}
          Ghosted
        </button>
      </div>

      <div className="hidden gap-2 mt-2 sm:flex">
        <button
          type="button"
          onClick={() => handleStatusClick("rejected")}
          disabled={pending}
          aria-label={pendingStatus === "rejected" ? "Updating Rejected" : "Rejected"}
          className={cn(
            "px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] border transition-colors cursor-pointer",
            currentStatus === "rejected"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border bg-background text-muted-foreground hover:ring-2 hover:ring-foreground/20",
            pending && "opacity-60"
          )}
        >
          {pendingStatus === "rejected" && <Loader2 role="status" aria-label="Updating Rejected" className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />}
          Rejected
        </button>
        <button
          type="button"
          onClick={() => handleStatusClick("withdrawn")}
          disabled={pending}
          aria-label={pendingStatus === "withdrawn" ? "Updating Withdrawn" : "Withdrawn"}
          className={cn(
            "px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] border transition-colors cursor-pointer",
            currentStatus === "withdrawn"
              ? "border-border bg-secondary text-muted-foreground"
              : "border-border bg-background text-muted-foreground hover:ring-2 hover:ring-foreground/20",
            pending && "opacity-60"
          )}
        >
          {pendingStatus === "withdrawn" && <Loader2 role="status" aria-label="Updating Withdrawn" className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />}
          Withdrawn
        </button>
        <button
          type="button"
          onClick={() => handleStatusClick("ghosted")}
          disabled={pending}
          aria-label={pendingStatus === "ghosted" ? "Updating Ghosted" : "Ghosted"}
          className={cn(
            "px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] border transition-colors cursor-pointer",
            currentStatus === "ghosted"
              ? "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300"
              : "border-border bg-background text-muted-foreground hover:ring-2 hover:ring-foreground/20",
            pending && "opacity-60"
          )}
        >
          {pendingStatus === "ghosted" && <Loader2 role="status" aria-label="Updating Ghosted" className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />}
          Ghosted
        </button>
      </div>
    </div>
  )
}

// ── Notes card ───────────────────────────────────────────────────────────────

function NotesCard({
  applicationId,
  initialNotes,
}: {
  applicationId: string
  initialNotes: string | null
}) {
  const [notes, setNotes] = useState(initialNotes ?? "")
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await updateNotes(formData)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="hidden" name="applicationId" value={applicationId} />
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setSaved(false) }}
            className="min-h-[120px] w-full border border-input bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            placeholder="Add private notes about this application…"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending ? "Saving…" : "Save notes"}
            </Button>
            {saved && <span className="text-xs text-muted-foreground">Saved</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ── Description card ─────────────────────────────────────────────────────────

const DESCRIPTION_PREVIEW_LINES = 6

function DescriptionCard({
  applicationId,
  initialDescription,
}: {
  applicationId: string
  initialDescription: string | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [description, setDescription] = useState(initialDescription ?? "")
  const [savedDescription, setSavedDescription] = useState(initialDescription ?? "")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const lines = description.split("\n")
  const isTruncatable = lines.length > DESCRIPTION_PREVIEW_LINES
  const preview = isTruncatable && !expanded
    ? lines.slice(0, DESCRIPTION_PREVIEW_LINES).join("\n")
    : description

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setSaveError(null)
    startTransition(async () => {
      const result = await updateDescription(formData)
      if (result?.error) {
        setSaveError(result.error)
      } else {
        setSavedDescription(description)
        setEditing(false)
        router.refresh()
      }
    })
  }

  function handleCancel() {
    setDescription(savedDescription)
    setSaveError(null)
    setEditing(false)
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Job Description</CardTitle>
        {!editing && (
          <CardAction>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="pt-5">
        {editing ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input type="hidden" name="applicationId" value={applicationId} />
            <textarea
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
              rows={12}
              className="w-full resize-none border border-input bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
              placeholder="Paste the full job description here…"
            />
            <div className="flex flex-col gap-2">
              {saveError && <p className="text-[12px] text-destructive">{saveError}</p>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
                <Button type="button" size="sm" variant="ghost" onClick={handleCancel} disabled={pending}>Cancel</Button>
              </div>
            </div>
          </form>
        ) : description ? (
          <div>
            <MarkdownContent content={preview} className="text-muted-foreground" />
            {isTruncatable && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 text-xs font-medium text-foreground underline underline-offset-2 hover:opacity-70 transition-opacity"
              >
                {expanded ? "Show less" : `Read more (${lines.length - DESCRIPTION_PREVIEW_LINES} more lines)`}
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">No description yet — click Edit to paste one.</p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Application chat ──────────────────────────────────────────────────────────

type ChatMessage = { role: "user" | "assistant"; content: string }

interface ApplicationChatPanelProps {
  messages: ChatMessage[]
  input: string
  isLoading: boolean
  messagesContainerRef: React.RefObject<HTMLDivElement | null>
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  onInputChange: (value: string) => void
  onMessagesScroll: () => void
  onSubmit: (e: React.FormEvent) => void
}

function ApplicationChatPanel({
  messages,
  input,
  isLoading,
  messagesContainerRef,
  messagesEndRef,
  onInputChange,
  onMessagesScroll,
  onSubmit,
}: ApplicationChatPanelProps) {
  return (
    <>
      <div
        ref={messagesContainerRef}
        onScroll={onMessagesScroll}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Ask anything about this role.
          </p>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] px-3 py-2 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-foreground text-background whitespace-pre-wrap"
                    : "border bg-secondary text-foreground"
                )}
              >
                {msg.role === "assistant" && msg.content ? (
                  <MarkdownContent content={msg.content} />
                ) : msg.content ? (
                  msg.content
                ) : isLoading && i === messages.length - 1 ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin opacity-50" />
                ) : null}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={onSubmit} className="flex gap-2 border-t pt-4">
        <Input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Ask about the company, role, or application…"
          aria-label="Message"
          className="flex-1"
        />
        <Button type="submit" size="default" disabled={isLoading || !input.trim()}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </>
  )
}

function ApplicationChat({ applicationId }: { applicationId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const shouldStickToBottomRef = useRef(true)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  function handleMessagesScroll() {
    const container = messagesContainerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    shouldStickToBottomRef.current = distanceFromBottom < 48
  }

  function scrollToLatestMessage() {
    if (shouldStickToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg: ChatMessage = { role: "user", content: text }
    const nextMessages = [...messages, userMsg]
    shouldStickToBottomRef.current = true
    setMessages([...nextMessages, { role: "assistant", content: "" }])
    setInput("")
    setIsLoading(true)

    try {
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      const res = await fetch("/api/chat/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, applicationId }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: "assistant",
            content: err.error ?? "Something went wrong. Please try again.",
          }
          return updated
        })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        const streamed = accumulated
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: "assistant", content: streamed }
          return updated
        })
        scrollToLatestMessage()
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Network error. Please try again.",
        }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <div>
            <CardTitle>Ask AI</CardTitle>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Ask about the company, tailor your CV, or get help with application questions.
            </p>
          </div>
          <CardAction>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(true)}
              aria-label="Open expanded chat"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex h-[560px] flex-col pt-0 md:h-[640px]">
          {!isExpanded && (
            <ApplicationChatPanel
              messages={messages}
              input={input}
              isLoading={isLoading}
              messagesContainerRef={messagesContainerRef}
              messagesEndRef={messagesEndRef}
              onInputChange={setInput}
              onMessagesScroll={handleMessagesScroll}
              onSubmit={sendMessage}
            />
          )}
        </CardContent>
      </Card>

      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="expanded-application-chat-title"
            className="flex h-[85vh] w-full max-w-5xl flex-col border border-border bg-background shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 id="expanded-application-chat-title" className="text-sm font-medium">
                  Expanded application chat
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ask about the company, role, CV, or application.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                aria-label="Close expanded chat"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-5 pt-0 pb-5">
              <ApplicationChatPanel
                messages={messages}
                input={input}
                isLoading={isLoading}
                messagesContainerRef={messagesContainerRef}
                messagesEndRef={messagesEndRef}
                onInputChange={setInput}
                onMessagesScroll={handleMessagesScroll}
                onSubmit={sendMessage}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── CV card ──────────────────────────────────────────────────────────────────

function CvCard({
  applicationId,
  applicationSlug,
  cvs,
  currentCvId,
  tailoredCvs,
  hasDescription,
}: {
  applicationId: string
  applicationSlug: string
  cvs: UserCvRow[]
  currentCvId: string | null
  tailoredCvs: TailoredCvRow[]
  hasDescription: boolean
}) {
  const { getActiveJob, trackJob } = useGenerationJobsContext()
  const router = useRouter()
  const primaryCv = cvs.find((cv) => cv.is_primary)
  const defaultValue = currentCvId ?? primaryCv?.id ?? ""
  const [savePending, startSaveTransition] = useTransition()
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const activeJob = getActiveJob(applicationId, "cv_tailor")
  const prevActiveJobIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (activeJob) {
      prevActiveJobIdRef.current = activeJob.id
    } else if (prevActiveJobIdRef.current !== undefined) {
      prevActiveJobIdRef.current = undefined
      router.refresh()
    }
  }, [activeJob, router])

  function handleSaveSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startSaveTransition(() => updateCv(formData))
  }

  async function handleGenerate() {
    setGenError(null)
    setGenerating(true)
    try {
      const res = await fetch(`/api/applications/${applicationId}/cv/generate`, { method: "POST" })
      const data = await res.json() as { jobId?: string; deduped?: boolean; error?: string }
      if (!res.ok) {
        setGenError(data.error ?? "Failed to start CV generation.")
      } else if (data.jobId) {
        trackJob({ id: data.jobId, applicationId, kind: "cv_tailor" })
      }
    } catch {
      setGenError("Network error. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  const latest = tailoredCvs.length > 0 ? parseSkillsGap(tailoredCvs[0].skills_gap) : null

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Base CV</CardTitle>
        {tailoredCvs.length > 0 && tailoredCvs[0].ats_score != null && (
          <CardAction>
            <Badge className={getAtsBadgeClass(tailoredCvs[0].ats_score!)}>
              ATS {tailoredCvs[0].ats_score}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="pt-5 space-y-4">
        {/* Base CV selector */}
        <form onSubmit={handleSaveSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="applicationId" value={applicationId} />
          <div className="flex-1 space-y-1.5 min-w-0">
            <Label htmlFor="cv-select">Select CV</Label>
            <select
              id="cv-select"
              name="cvId"
              defaultValue={defaultValue}
              className="form-select bg-background"
            >
              <option value="">— None —</option>
              {cvs.map((cv) => (
                <option key={cv.id} value={cv.id}>
                  {cv.name ?? "Untitled CV"}
                  {cv.is_primary ? " (primary)" : ""}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="default" variant="outline" disabled={savePending} className="w-full sm:w-auto">
            {savePending ? "Saving…" : "Save"}
          </Button>
        </form>

        {/* AI generation section */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            {!activeJob && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!hasDescription || generating}
                onClick={handleGenerate}
                className="w-full sm:w-auto"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Starting…
                  </>
                ) : tailoredCvs.length > 0 ? (
                  "Regenerate"
                ) : (
                  "Generate tailored CV"
                )}
              </Button>
            )}
            {tailoredCvs.length > 0 && (
              <Link
                href={applicationPath(applicationSlug, "/cv")}
                className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full justify-center sm:w-auto")}
              >
                Preview &amp; Download CV
              </Link>
            )}
            {!hasDescription && !activeJob && (
              <span className="text-[12px] text-muted-foreground">
                Add a job description first
              </span>
            )}
          </div>

          {activeJob && (
            <GenerationProgress label="tailored CV" startedAt={activeJob.created_at} />
          )}

          {genError && (
            <p className="text-[12px] text-destructive">{genError}</p>
          )}

          {latest && (
            <div className="space-y-2">
              {latest.changes && (
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  {latest.changes}
                </p>
              )}
              {latest.gap.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {latest.gap.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center border px-2 py-0.5 text-[11px] font-medium border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : latest.changes ? (
                <p className="text-[12px] text-muted-foreground">No skills gap detected.</p>
              ) : null}
            </div>
          )}

          {/* History rows for older versions */}
          {tailoredCvs.length > 1 && (
            <div className="space-y-1 pt-1">
              {tailoredCvs.slice(1).map((cv) => (
                <div key={cv.id} className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(cv.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </span>
                  {cv.ats_score != null && (
                    <span className="text-[11px] text-muted-foreground">
                      ATS {cv.ats_score}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Cover letter card ────────────────────────────────────────────────────────

const TONES = [
  { value: "professional", label: "Professional" },
  { value: "enthusiastic", label: "Enthusiastic" },
  { value: "conservative", label: "Conservative" },
  { value: "story", label: "Story" },
] as const

function CoverLetterCard({
  applicationId,
  applicationSlug,
  jobTitle,
  jobCompany,
  writingStyles,
  currentStructureId,
  currentTone,
  generatedCoverLetter,
  hasDescription,
}: {
  applicationId: string
  applicationSlug: string
  jobTitle: string | null
  jobCompany: string | null
  writingStyles: WritingStyleRow[]
  currentStructureId: string | null
  currentTone: string | null
  generatedCoverLetter: GeneratedCoverLetterRow | null
  hasDescription: boolean
}) {
  const { getActiveJob, trackJob } = useGenerationJobsContext()
  const router = useRouter()
  const defaultStructureId = currentStructureId ?? writingStyles.find((s) => s.is_built_in)?.id ?? ""
  const defaultToneForStructure = writingStyles.find((s) => s.id === defaultStructureId)?.default_tone ?? "professional"
  const [selectedStructureId, setSelectedStructureId] = useState(defaultStructureId)
  const [selectedTone, setSelectedTone] = useState(currentTone ?? defaultToneForStructure)
  const [showToneOverride, setShowToneOverride] = useState(false)
  const [savePending, startSaveTransition] = useTransition()
  const [genPending, startGenTransition] = useTransition()
  const [genError, setGenError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const activeJob = getActiveJob(applicationId, "cover_letter")
  const prevActiveJobIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (activeJob) {
      prevActiveJobIdRef.current = activeJob.id
    } else if (prevActiveJobIdRef.current !== undefined) {
      prevActiveJobIdRef.current = undefined
      router.refresh()
    }
  }, [activeJob, router])

  const filenameBase = buildCoverLetterFilenameBase({ fullName: null, company: jobCompany, role: jobTitle })
  const { handleDownloadPdf, isDownloading: downloading } = useDownloadPdf({
    type: "cover-letter",
    applicationId,
    template: "modern",
    filenamePrefix: "cover-letter",
    filenameBase,
  })

  function handleStructureChange(structureId: string) {
    setSelectedStructureId(structureId)
    const style = writingStyles.find((s) => s.id === structureId)
    if (style) setSelectedTone(style.default_tone)
    setShowToneOverride(false)
    const fd = new FormData()
    fd.set("applicationId", applicationId)
    fd.set("structureId", structureId)
    fd.set("tone", style?.default_tone ?? "professional")
    startSaveTransition(() => updateWritingStyle(fd))
  }

  function handleToneChange(tone: string) {
    setSelectedTone(tone)
    const fd = new FormData()
    fd.set("applicationId", applicationId)
    fd.set("structureId", selectedStructureId)
    fd.set("tone", tone)
    startSaveTransition(() => updateWritingStyle(fd))
  }

  function handleGenerate() {
    setGenError(null)
    startGenTransition(async () => {
      const result = await generateCoverLetter(applicationId)
      if (result?.error) {
        setGenError(result.error)
      } else if (result?.jobId) {
        trackJob({ id: result.jobId, applicationId, kind: "cover_letter" })
      }
    })
  }

  function handleCopy() {
    if (!generatedCoverLetter?.content) return
    navigator.clipboard.writeText(generatedCoverLetter.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const generatedDate = generatedCoverLetter
    ? new Date(generatedCoverLetter.created_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Cover Letter</CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-4">
        {/* Writing Style selector */}
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="writing-style-select">Writing Style</Label>
            <div className="flex items-center gap-2">
              <select
                id="writing-style-select"
                value={selectedStructureId}
                onChange={(e) => handleStructureChange(e.target.value)}
                disabled={savePending}
                className="form-select bg-background flex-1"
              >
                {writingStyles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                    {s.is_built_in ? "" : " (custom)"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowToneOverride((v) => !v)}
                className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground transition-colors border border-border px-2 py-1.5"
              >
                {TONES.find((t) => t.value === selectedTone)?.label ?? "Tone"}
              </button>
            </div>
          </div>
          {showToneOverride && (
            <div className="flex flex-wrap gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => { handleToneChange(t.value); setShowToneOverride(false) }}
                  className={cn(
                    "border px-3 py-1 text-xs transition-colors",
                    selectedTone === t.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* AI generation section */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {!activeJob && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={genPending || !hasDescription}
                onClick={handleGenerate}
                className="w-full sm:w-auto"
              >
                {genPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Starting…
                  </>
                ) : generatedCoverLetter ? (
                  "Regenerate cover letter"
                ) : (
                  "Generate cover letter"
                )}
              </Button>
            )}
            {generatedCoverLetter && (
              <Link
                href={applicationPath(applicationSlug, "/cover-letter")}
                className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full justify-center sm:w-auto")}
              >
                Preview &amp; Download Cover Letter
              </Link>
            )}
            {!hasDescription && (
              <span className="text-[12px] text-muted-foreground">
                Add a job description first
              </span>
            )}
          </div>

          {activeJob && (
            <GenerationProgress label="cover letter" startedAt={activeJob.created_at} />
          )}

          {genError && (
            <p className="text-[12px] text-destructive">{genError}</p>
          )}

          {generatedCoverLetter && (
            <div className="border bg-secondary/40 px-4 py-3 space-y-3">
              {/* Meta + teaser */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Generated {generatedDate}{generatedCoverLetter.tone ? ` · ${generatedCoverLetter.tone}` : ""}
                </p>
                <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-2">
                  {generatedCoverLetter.content?.slice(0, 160)}…
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                >
                  {copied ? "Copied!" : "Copy text"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                >
                  {downloading ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />Downloading…</>
                  ) : (
                    "Download PDF"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

function DeleteButton({ applicationId }: { applicationId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  if (confirming) {
    return (
      <div className="flex w-full gap-2 sm:w-auto">
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="flex-1 sm:flex-none"
          disabled={pending}
          onClick={() => startTransition(async () => { await deleteApplication(applicationId) })}
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {pending ? "Deleting…" : "Yes, delete"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setConfirming(false)}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="w-full justify-center text-muted-foreground hover:text-destructive sm:w-auto"
      onClick={() => setConfirming(true)}
    >
      <Trash2 className="h-3.5 w-3.5" />
      Delete
    </Button>
  )
}

type EditableJobField = "title" | "company" | "location" | "salary"

export function InlineJobDetail({
  applicationId,
  field,
  label,
  extractedValue,
  initialOverride,
  fallback,
  displayClassName,
}: {
  applicationId: string
  field: EditableJobField
  label: string
  extractedValue: string | null
  initialOverride: string | null
  fallback: string
  displayClassName?: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [savedOverride, setSavedOverride] = useState(initialOverride)
  const [value, setValue] = useState(initialOverride ?? extractedValue ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const effectiveValue = savedOverride ?? extractedValue ?? ""

  function closeEditor() {
    setValue(effectiveValue)
    setError(null)
    setEditing(false)
  }

  function submit(useExtracted = false) {
    const formData = new FormData()
    formData.set("applicationId", applicationId)
    formData.set("field", field)
    formData.set("value", value)
    if (useExtracted) formData.set("useExtracted", "true")

    setError(null)
    startTransition(async () => {
      const result = await updateJobDetail(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setSavedOverride(useExtracted ? null : value.trim())
      setEditing(false)
      router.refresh()
    })
  }

  if (editing) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="flex max-w-xl flex-col gap-2"
      >
        <Label htmlFor={`job-detail-${field}`} className="sr-only">{label}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={`job-detail-${field}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") closeEditor()
            }}
            autoFocus
            disabled={pending}
            className="h-9 min-w-0"
          />
          <Button type="submit" size="icon-sm" disabled={pending} aria-label={`Save ${label}`}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" onClick={closeEditor} disabled={pending} aria-label={`Cancel editing ${label}`}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex min-h-5 items-center gap-3">
          {savedOverride !== null && (
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={pending}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:opacity-60"
            >
              <RotateCcw className="h-3 w-3" />
              Use extracted value
            </button>
          )}
          {error && <span className="text-[11px] text-destructive">{error}</span>}
        </div>
      </form>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(effectiveValue)
        setEditing(true)
      }}
      className={cn(
        "group inline-flex max-w-full items-center gap-2 text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        displayClassName,
      )}
      aria-label={`Edit ${label}: ${effectiveValue || fallback}`}
      title={`Edit ${label}`}
    >
      <span className="min-w-0 truncate">{effectiveValue || fallback}</span>
      <Pencil className="h-3.5 w-3.5 shrink-0 opacity-45 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </button>
  )
}

function formatExtractedSalary(job: JobsCacheRow | null): string | null {
  if (job?.salary_min == null) return null
  const currency = job.salary_currency ?? "GBP"
  const formatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  })
  const minimum = formatter.format(Number(job.salary_min))
  const maximum = job.salary_max == null ? null : formatter.format(Number(job.salary_max))
  return maximum ? `${minimum} – ${maximum}` : minimum
}

export function ApplicationDetail({
  application,
  cvs,
  writingStyles,
  tailoredCvs,
  generatedCoverLetter,
  followUpDueAt,
  followUpNotes,
}: Props) {
  const job = application.jobs_cache
  const hasDescription = !!(application.custom_description || job?.description)

  const extractedSalary = formatExtractedSalary(job)

  const postedAt = job?.posted_at
      ? new Date(job.posted_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
    : null

  const sourceLabel = job?.source
    ? job.source.charAt(0).toUpperCase() + job.source.slice(1)
    : null

  const detailItems = [
    postedAt ? { label: "Posted", value: postedAt } : null,
    sourceLabel ? { label: "Source", value: sourceLabel } : null,
    application.created_at
      ? {
          label: "Saved",
          value: new Date(application.created_at).toLocaleDateString(
            "en-GB",
            { day: "numeric", month: "short", year: "numeric" }
          ),
        }
      : null,
    application.applied_at
      ? {
          label: "Applied",
          value: new Date(application.applied_at).toLocaleDateString(
            "en-GB",
            { day: "numeric", month: "short", year: "numeric" }
          ),
        }
      : null,
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div className="page-shell">
      {/* Page header */}
      <div className="page-header">
        <div className="space-y-3">
          <p className="page-kicker">Application</p>
          <div className="space-y-2">
            <InlineJobDetail
              applicationId={application.id}
              field="title"
              label="role"
              extractedValue={job?.title ?? null}
              initialOverride={application.custom_title}
              fallback="Unknown Role"
              displayClassName="page-title"
            />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
              <InlineJobDetail
                applicationId={application.id}
                field="company"
                label="company"
                extractedValue={job?.company ?? null}
                initialOverride={application.custom_company}
                fallback="Unknown company"
                displayClassName="page-lede"
              />
              <span aria-hidden="true">·</span>
              <InlineJobDetail
                applicationId={application.id}
                field="location"
                label="location"
                extractedValue={job?.location ?? null}
                initialOverride={application.custom_location}
                fallback="Add location"
                displayClassName="page-lede"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <InlineJobDetail
              applicationId={application.id}
              field="salary"
              label="salary"
              extractedValue={extractedSalary}
              initialOverride={application.custom_salary_text}
              fallback="Add salary"
              displayClassName="text-sm text-muted-foreground"
            />
            <Badge className={getStatusBadgeClass(application.status)}>
              {getStatusLabel(application.status)}
            </Badge>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <Link
            href="/applications"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full justify-center sm:w-auto")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to pipeline
          </Link>
          <Link
            href={`/interview?application=${application.slug}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-center sm:w-auto")}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Interview Prep
          </Link>
          <a
            href={`/api/applications/${application.id}/export`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-center sm:w-auto")}
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </a>
          {job?.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-center sm:w-auto")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View posting
            </a>
          )}
          <DeleteButton applicationId={application.id} />
        </div>
      </div>

      {/* Status pipeline */}
      <Card>
        <CardContent className="pt-5 pb-5 sm:pt-6">
          <StatusStepper currentStatus={application.status} applicationId={application.id} />
        </CardContent>
      </Card>

      {/* Metadata bar */}
      {(detailItems.length > 0 || job?.is_easy_apply != null) && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 border border-border bg-secondary/30 px-4 py-3">
          {detailItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</span>
              <span className="text-xs font-medium text-foreground">{item.value}</span>
            </div>
          ))}
          {job?.is_easy_apply != null && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Easy Apply</span>
              <Badge className={job.is_easy_apply
                ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
                : "border-border bg-secondary text-foreground"
              }>
                {job.is_easy_apply ? "Yes" : "No"}
              </Badge>
            </div>
          )}
          {job?.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors ml-auto">
              <ExternalLink className="h-3 w-3" />
              Job posting
            </a>
          )}
        </div>
      )}

      {/* Job description — full width, collapsible */}
      <DescriptionCard
        applicationId={application.id}
        initialDescription={application.custom_description ?? job?.description ?? null}
      />

      {/* 2-col card grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        <CvCard
          applicationId={application.id}
          applicationSlug={application.slug}
          cvs={cvs}
          currentCvId={application.selected_cv_id}
          tailoredCvs={tailoredCvs}
          hasDescription={hasDescription}
        />
        <CoverLetterCard
          applicationId={application.id}
          applicationSlug={application.slug}
          jobTitle={application.custom_title ?? job?.title ?? null}
          jobCompany={application.custom_company ?? job?.company ?? null}
          writingStyles={writingStyles}
          currentStructureId={application.structure_id ?? null}
          currentTone={application.cover_letter_tone ?? null}
          generatedCoverLetter={generatedCoverLetter}
          hasDescription={hasDescription}
        />
        <NotesCard
          applicationId={application.id}
          initialNotes={application.notes}
        />
        <FollowUpCard
          applicationId={application.id}
          initialFollowUpDueAt={followUpDueAt}
          initialFollowUpNotes={followUpNotes}
        />
      </div>

      {/* AI chat — full width */}
      <ApplicationChat applicationId={application.id} />
    </div>
  )
}
