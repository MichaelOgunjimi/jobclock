import type { QuestionDefinition } from "./types"

interface PromptFact {
  id: string
  category: string
  label: string
  detail: string
}

interface PromptStory {
  id: string
  title: string
  situation: string | null
  task: string | null
  action: string | null
  result: string | null
  tags: string[]
}

interface PromptApplication {
  title: string
  company: string
  description: string
  researchContent?: string | null
}

export const INTERVIEW_ANSWER_SYSTEM_PROMPT = `Write a first-person interview answer that sounds natural when spoken.
Use only the confirmed evidence provided.
Never invent events, dates, responsibilities, tools, metrics, or outcomes.
Use STAR internally for example-based questions, but do not print STAR headings.
Keep the answer under 250 words.
Return only the answer, with no preamble or markdown headings.`

export function buildInterviewAnswerPrompt({
  question,
  evidence,
  application,
}: {
  question: QuestionDefinition
  evidence: { facts: PromptFact[]; stories: PromptStory[] }
  application: PromptApplication | null
}): string {
  const facts = evidence.facts.length
    ? evidence.facts
        .map(
          (fact) =>
            `[${fact.id}] ${fact.category}: ${fact.label}\n${fact.detail}`,
        )
        .join("\n\n")
    : "None."

  const stories = evidence.stories.length
    ? evidence.stories
        .map(
          (story) => `[${story.id}] ${story.title}
Situation: ${story.situation || "Not provided"}
Task: ${story.task || "Not provided"}
Action: ${story.action || "Not provided"}
Result: ${story.result || "Not provided"}
Tags: ${story.tags.join(", ") || "None"}`,
        )
        .join("\n\n")
    : "None."

  const jobContext = application
    ? `## Job context
Tailor the emphasis to the ${application.title} at ${application.company}.
${application.description || "No job description is available."}

## Company research
${application.researchContent?.trim() || "No saved company research is available."}

Job context and company research may change emphasis only. Do not add facts, metrics, tools, or outcomes about the candidate that are not in the confirmed evidence.`
    : `## Answer scope
This is a reusable general answer. Do not mention or imply a specific employer or job.`

  return `## Interview question
${question.text}

## Confirmed profile facts
${facts}

## Confirmed stories
${stories}

${jobContext}

## Instructions
Use only the confirmed evidence above. Write a complete, conversational answer in the candidate's first-person voice. ${
    question.requiresStory
      ? "Use the strongest matching story and make the candidate's own actions clear."
      : "Connect the strongest profile facts into a coherent answer."
  }`
}
