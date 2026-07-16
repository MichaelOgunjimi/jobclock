import type {
  EvidenceAssessment,
  EvidenceSnapshot,
  InterviewQuestionCategory,
  ProfileFactEvidence,
  QuestionDefinition,
  StoryEvidence,
} from "./types"

type EvidenceCandidate = ProfileFactEvidence | StoryEvidence
type Now = Date | string

const STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "describe",
  "do",
  "example",
  "give",
  "how",
  "i",
  "interview",
  "me",
  "of",
  "or",
  "question",
  "role",
  "tell",
  "the",
  "this",
  "time",
  "to",
  "what",
  "when",
  "with",
  "want",
  "why",
  "you",
  "your",
  "yourself",
])

const DISCOVERY_PROMPTS: Record<InterviewQuestionCategory, string[]> = {
  opening: [
    "Which parts of your education, recent work, or personal projects best explain what you are focused on now?",
    "What two or three confirmed experiences would you want an interviewer to remember about you?",
  ],
  motivation: [
    "Which part of this role connects most clearly to a project, course, or self-directed learning you genuinely enjoyed?",
    "During your job search, what work or responsibility have you repeatedly chosen to pursue, and why?",
  ],
  strengths: [
    "Which skill have you used repeatedly in university, work, volunteering, or personal projects?",
    "When have classmates, teammates, or colleagues relied on you for something specific?",
  ],
  resilience: [
    "Think of a university, relocation, job-search, or project setback. What changed, and what did you do next?",
    "When did you have to keep making progress despite uncertainty or limited resources?",
  ],
  teamwork: [
    "Recall a university, work, or volunteer team where people disagreed. What did you do to help the group move forward?",
    "When have you adjusted how you communicated to support a teammate or classmate?",
  ],
  leadership: [
    "In a university, project, volunteer, or work team, when did you organise the next step without being asked?",
    "When have other people depended on you to coordinate a deadline, decision, or shared piece of work?",
  ],
  initiative: [
    "What useful task did you notice and take on during a project, job search, volunteering, or self-directed learning?",
    "When did you improve something beyond the minimum that was requested?",
  ],
  pressure: [
    "Think of a real university, work, relocation, or project deadline. How did you decide what to do first?",
    "When have several responsibilities competed for your attention, and how did you keep the work moving?",
  ],
  mistakes: [
    "What ordinary mistake in university, work, or a personal project changed how you approach similar work now?",
    "When did feedback reveal something you had missed, and what did you change afterward?",
  ],
  custom: [
    "Which real university, work, project, volunteering, or job-search experience is closest to this question?",
    "What did you personally do, and which details can you confirm without guessing?",
  ],
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function words(value: string): Set<string> {
  return new Set(
    normalize(value)
      .split(/\s+/)
      .filter((word) => word && !STOP_WORDS.has(word)),
  )
}

function scoreCandidate(
  question: QuestionDefinition,
  candidate: EvidenceCandidate,
): { eligible: boolean; score: number } {
  const category = normalize(candidate.category ?? "")
  const questionCategory = normalize(question.category)
  const questionTags = new Set(question.evidenceTags.map(normalize))
  const candidateTags = candidate.tags.map(normalize)
  const categoryMatch = category === questionCategory
  const categoryTagMatch = questionTags.has(category)
  const tagMatchCount = candidateTags.filter((tag) =>
    questionTags.has(tag),
  ).length

  let score = categoryMatch ? 1_000 : 0
  score += categoryTagMatch ? 500 : 0
  score += tagMatchCount * 500

  const questionWords = words(
    [question.text, question.category, ...question.evidenceTags].join(" "),
  )
  const searchableText =
    "label" in candidate
      ? [candidate.label, candidate.detail]
      : [
          candidate.title,
          candidate.situation,
          candidate.task,
          candidate.action,
          candidate.result,
        ]
  const candidateWords = words(
    [
      candidate.category ?? "",
      ...searchableText,
      ...candidate.tags,
    ]
      .filter((value): value is string => value !== null)
      .join(" "),
  )

  let overlapCount = 0
  for (const word of questionWords) {
    if (candidateWords.has(word)) {
      overlapCount += 1
      score += 10
    }
  }

  return {
    eligible:
      categoryMatch ||
      categoryTagMatch ||
      tagMatchCount > 0 ||
      overlapCount >= 2,
    score,
  }
}

function selectIds(
  question: QuestionDefinition,
  candidates: EvidenceCandidate[],
  limit: number,
): string[] {
  return candidates
    .map((candidate) => ({
      candidate,
      rank: scoreCandidate(question, candidate),
    }))
    .filter(
      ({ candidate, rank }) =>
        candidate.confirmedAt !== null &&
        !(
          "sourceType" in candidate &&
          candidate.sourceType === "cv" &&
          candidate.isCurrentSource === false
        ) &&
        rank.eligible,
    )
    .sort(
      (left, right) =>
        right.rank.score - left.rank.score ||
        left.candidate.id.localeCompare(right.candidate.id),
    )
    .slice(0, limit)
    .map(({ candidate }) => candidate.id)
}

function timestamp(now: Now): string {
  return typeof now === "string" ? new Date(now).toISOString() : now.toISOString()
}

export function selectEvidence(
  question: QuestionDefinition,
  facts: ProfileFactEvidence[],
  stories: StoryEvidence[],
  now: Now = new Date(),
): EvidenceSnapshot {
  return {
    factIds: selectIds(question, facts, 6),
    storyIds: selectIds(question, stories, 3),
    generatedAt: timestamp(now),
  }
}

export function discoveryPromptsFor(
  category: InterviewQuestionCategory,
): string[] {
  return [...DISCOVERY_PROMPTS[category]]
}

export function assessEvidence(
  question: QuestionDefinition,
  facts: ProfileFactEvidence[],
  stories: StoryEvidence[],
  now: Now = new Date(),
): EvidenceAssessment {
  const selected = selectEvidence(question, facts, stories, now)

  if (question.requiresStory && selected.storyIds.length === 0) {
    return {
      sufficient: false,
      reason: "story_required",
      suggestedPrompts: discoveryPromptsFor(question.category),
    }
  }

  if (!question.requiresStory && selected.factIds.length < 2) {
    return {
      sufficient: false,
      reason: "profile_required",
      suggestedPrompts: discoveryPromptsFor(question.category),
    }
  }

  return { sufficient: true, evidence: selected }
}
