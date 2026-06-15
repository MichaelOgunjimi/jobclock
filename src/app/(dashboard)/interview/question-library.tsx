"use client"

import { useState, useTransition } from "react"
import { Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createQuestion } from "./actions"
import type {
  InterviewQuestionCategory,
  InterviewQuestionView,
} from "./data"

const categoryLabels: Record<InterviewQuestionCategory, string> = {
  opening: "Opening",
  motivation: "Motivation",
  strengths: "Strengths",
  resilience: "Resilience",
  teamwork: "Teamwork",
  leadership: "Leadership",
  initiative: "Initiative",
  pressure: "Pressure",
  mistakes: "Learning",
  custom: "Custom",
}

export function QuestionLibrary({
  questions,
  selectedKey,
  onSelect,
  onCreated,
}: {
  questions: InterviewQuestionView[]
  selectedKey: string | null
  onSelect: (question: InterviewQuestionView) => void
  onCreated: (question: InterviewQuestionView) => void
}) {
  const [search, setSearch] = useState("")
  const [adding, setAdding] = useState(false)
  const [questionText, setQuestionText] = useState("")
  const [category, setCategory] =
    useState<InterviewQuestionCategory>("custom")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const filtered = questions.filter((question) =>
    question.text.toLowerCase().includes(search.toLowerCase()),
  )

  function addQuestion() {
    startTransition(async () => {
      setError("")
      const result = await createQuestion({
        text: questionText,
        category,
        sourceType: "custom",
      })
      if ("error" in result) {
        setError(result.error)
        return
      }

      const now = new Date().toISOString()
      const created: InterviewQuestionView = {
        id: result.id,
        key: result.id,
        text: questionText.trim(),
        category,
        sourceType: "custom",
        sourceRef: result.id,
        applicationId: null,
        requiresStory: !["opening", "motivation", "strengths"].includes(
          category,
        ),
        evidenceTags: [category],
        createdAt: now,
        updatedAt: now,
      }
      onCreated(created)
      setQuestionText("")
      setCategory("custom")
      setAdding(false)
    })
  }

  return (
    <aside className="border border-border bg-card">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Question library</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {questions.length} questions ready to practise
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdding((value) => !value)}
          >
            <Plus className="mr-1.5 size-3.5" />
            Add
          </Button>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search questions"
            className="pl-9"
          />
        </div>
      </div>

      {adding && (
        <div className="space-y-3 border-b border-border bg-secondary/25 p-4">
          <textarea
            value={questionText}
            onChange={(event) => setQuestionText(event.target.value)}
            placeholder="Add a question you want to practise..."
            rows={3}
            className="w-full resize-none border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as InterviewQuestionCategory)
            }
            className="h-9 w-full border border-border bg-background px-3 text-sm"
          >
            {Object.entries(categoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={addQuestion}
              disabled={pending || !questionText.trim()}
            >
              {pending ? "Adding..." : "Add question"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="max-h-[620px] overflow-y-auto">
        {filtered.map((question, index) => (
          <button
            type="button"
            key={`${question.key}-${index}`}
            onClick={() => onSelect(question)}
            className={`w-full border-b border-border px-4 py-3.5 text-left transition-colors last:border-b-0 ${
              selectedKey === question.key
                ? "bg-foreground text-background"
                : "hover:bg-secondary/55"
            }`}
          >
            <span
              className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${
                selectedKey === question.key
                  ? "text-background/60"
                  : "text-muted-foreground"
              }`}
            >
              {categoryLabels[question.category]}
            </span>
            <span className="mt-1 block text-sm font-medium leading-snug">
              {question.text}
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}
