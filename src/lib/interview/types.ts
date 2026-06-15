export type InterviewQuestionCategory =
  | "opening"
  | "motivation"
  | "strengths"
  | "resilience"
  | "teamwork"
  | "leadership"
  | "initiative"
  | "pressure"
  | "mistakes"
  | "custom"

export type ProfileFactCategory =
  | "summary"
  | "education"
  | "experience"
  | "project"
  | "skill"
  | "certification"
  | "activity"
  | "language"

export interface QuestionDefinition {
  key: string
  text: string
  category: InterviewQuestionCategory
  requiresStory: boolean
  evidenceTags: string[]
}

export interface ProfileFactDraft {
  category: ProfileFactCategory
  label: string
  detail: string
  sourceType: "cv"
  logicalSourceRef: string
  contentDigest: string
  sourceRef: string
  confirmedAt: null
}

export interface ProfileFactEvidence {
  id: string
  category: string
  label: string
  detail: string
  tags: string[]
  confirmedAt: string | null
  updatedAt: string
  sourceType: "cv" | "manual" | "discovery"
  sourceRef: string | null
  // Only CV facts use this to mark stale imported versions.
  isCurrentSource: boolean
}

export interface StoryEvidence {
  id: string
  category?: string
  title: string
  situation: string | null
  task: string | null
  action: string | null
  result: string | null
  tags: string[]
  confirmedAt: string | null
  updatedAt: string
}

export interface EvidenceSnapshot {
  factIds: string[]
  storyIds: string[]
  generatedAt: string
}

export type EvidenceAssessment =
  | { sufficient: true; evidence: EvidenceSnapshot }
  | {
      sufficient: false
      reason: "story_required" | "profile_required"
      suggestedPrompts: string[]
    }
