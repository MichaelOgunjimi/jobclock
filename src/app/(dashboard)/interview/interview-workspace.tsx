"use client"

import { useState } from "react"
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

export function InterviewWorkspace({
  initial,
}: {
  initial: InterviewWorkspaceData
}) {
  const [questions, setQuestions] = useState(initial.questions)
  const [selected, setSelected] = useState<InterviewQuestionView | null>(
    initial.questions[0] ?? null,
  )

  function addQuestion(question: InterviewQuestionView) {
    setQuestions((current) => [question, ...current])
    setSelected(question)
  }

  function persistQuestion(key: string, id: string) {
    setQuestions((current) =>
      current.map((question) =>
        question.key === key ? { ...question, id } : question,
      ),
    )
    setSelected((current) =>
      current?.key === key ? { ...current, id } : current,
    )
  }

  return (
    <Tabs defaultValue="questions">
      <TabsList className="mb-5 overflow-x-auto">
        <TabsTrigger value="questions">Questions</TabsTrigger>
        <TabsTrigger value="practice">Practice</TabsTrigger>
        <TabsTrigger value="stories">Story Bank</TabsTrigger>
        <TabsTrigger value="about">About Me</TabsTrigger>
      </TabsList>

      <TabsContent value="questions">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
          <QuestionLibrary
            questions={questions}
            selectedKey={selected?.key ?? null}
            onSelect={setSelected}
            onCreated={addQuestion}
          />
          {selected ? (
            <AnswerComposer
              question={selected}
              answers={initial.answers}
              applications={initial.applications}
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
        <PracticeSession questions={questions} answers={initial.answers} />
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
  )
}
