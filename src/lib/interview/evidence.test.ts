import { describe, expect, it } from "vitest"
import {
  COMMON_INTERVIEW_QUESTIONS,
  COMMON_INTERVIEW_QUESTIONS_BY_KEY,
  resolveQuestionDefinition,
} from "./question-catalog"
import {
  assessEvidence,
  discoveryPromptsFor,
  selectEvidence,
} from "./evidence"
import type {
  InterviewQuestionCategory,
  ProfileFactEvidence,
  QuestionDefinition,
  StoryEvidence,
} from "./types"

const NOW = new Date("2026-06-15T12:00:00.000Z")

function commonQuestion(key: string): QuestionDefinition {
  const question = COMMON_INTERVIEW_QUESTIONS_BY_KEY.get(key)
  if (!question) throw new Error(`Missing common question: ${key}`)
  return question
}

const openingQuestion = commonQuestion("tell-me-about-yourself")
const leadershipQuestion = commonQuestion("lead-or-take-initiative")
const motivationQuestion = commonQuestion("why-this-role")

const customQuestion: QuestionDefinition = {
  key: "custom-collaboration",
  text: "How do you collaborate with other people?",
  category: "custom",
  requiresStory: false,
  evidenceTags: ["collaboration"],
}

const confirmedFacts: ProfileFactEvidence[] = [
  {
    id: "fact-summary",
    category: "summary",
    label: "Profile summary",
    detail: "Software engineer building useful web products.",
    tags: ["opening", "profile"],
    confirmedAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    sourceType: "cv",
    sourceRef: "cv:summary:profile-summary:current",
    isCurrentSource: true,
  },
  {
    id: "fact-experience",
    category: "experience",
    label: "Assistant at Example",
    detail: "Supported weekly reporting.",
    tags: ["opening", "experience"],
    confirmedAt: "2026-06-01T10:00:00.000Z",
    updatedAt: "2026-06-01T10:00:00.000Z",
    sourceType: "cv",
    sourceRef: "cv:experience:assistant-at-example:current",
    isCurrentSource: true,
  },
]

const unconfirmedFacts = confirmedFacts.map((fact) => ({
  ...fact,
  confirmedAt: null,
}))

const unconfirmedStories: StoryEvidence[] = [
  {
    id: "story-unconfirmed",
    category: "teamwork",
    title: "Coursework collaboration",
    situation: "Worked with classmates on a group project.",
    task: null,
    action: null,
    result: null,
    tags: ["collaboration", "teamwork"],
    confirmedAt: null,
    updatedAt: "2026-06-01T10:00:00.000Z",
  },
]

describe("COMMON_INTERVIEW_QUESTIONS", () => {
  it("exposes a guarded read-only lookup by stable key", () => {
    expect(COMMON_INTERVIEW_QUESTIONS_BY_KEY).toBeInstanceOf(Map)
    expect(COMMON_INTERVIEW_QUESTIONS_BY_KEY.get("tell-me-about-yourself")).toBe(
      openingQuestion,
    )
    expect(COMMON_INTERVIEW_QUESTIONS_BY_KEY.get("missing-question")).toBeUndefined()
  })

  it("contains stable definitions for all required user-facing questions", () => {
    expect(COMMON_INTERVIEW_QUESTIONS.map((question) => question.text)).toEqual(
      expect.arrayContaining([
        "Tell me about yourself.",
        "Why do you want this role?",
        "What are your greatest strengths?",
        "Tell me about a challenge you overcame.",
        "Describe a conflict with a teammate.",
        "Tell me about a time you led or took initiative.",
        "Tell me about a mistake and what you learned.",
        "Tell me about a time you worked under pressure.",
        "Tell me about a time you went the extra mile.",
        "What achievement are you most proud of?",
      ]),
    )
    expect(
      COMMON_INTERVIEW_QUESTIONS.every((question) =>
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(question.key),
      ),
    ).toBe(true)
    expect(new Set(COMMON_INTERVIEW_QUESTIONS.map(({ key }) => key)).size).toBe(
      COMMON_INTERVIEW_QUESTIONS.length,
    )
  })

  it("defines non-empty stable keys and tags with the intended evidence mode", () => {
    const profileQuestionKeys = new Set([
      "tell-me-about-yourself",
      "why-this-role",
      "greatest-strengths",
    ])

    for (const question of COMMON_INTERVIEW_QUESTIONS) {
      expect(question.key).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(question.evidenceTags.length).toBeGreaterThan(0)
      expect(question.evidenceTags.every((tag) => tag.trim().length > 0)).toBe(
        true,
      )
      expect(question.requiresStory).toBe(!profileQuestionKeys.has(question.key))
    }
  })

  it("resolves persisted category policy with category-specific tags", () => {
    const profileCategories: InterviewQuestionCategory[] = [
      "opening",
      "motivation",
      "strengths",
    ]
    const storyCategories: InterviewQuestionCategory[] = [
      "resilience",
      "teamwork",
      "leadership",
      "initiative",
      "pressure",
      "mistakes",
    ]

    for (const category of profileCategories) {
      const definition = resolveQuestionDefinition({
        key: `persisted-${category}`,
        text: `Persisted ${category} question`,
        category,
      })
      expect(definition.requiresStory).toBe(false)
      expect(definition.evidenceTags).toContain(category)
    }

    for (const category of storyCategories) {
      const definition = resolveQuestionDefinition({
        key: `persisted-${category}`,
        text: `Persisted ${category} question`,
        category,
      })
      expect(definition.requiresStory).toBe(true)
      expect(definition.evidenceTags).toContain(category)
    }
  })

  it("uses clear example phrasing to resolve custom question policy", () => {
    for (const text of [
      "Tell me about a time you helped a teammate.",
      "Describe a time you changed direction.",
      "Give an example of solving a difficult problem.",
      "When have you persuaded someone?",
    ]) {
      expect(
        resolveQuestionDefinition({
          key: "custom-example",
          text,
          category: "custom",
        }),
      ).toMatchObject({
        requiresStory: true,
        evidenceTags: expect.arrayContaining(["custom", "example"]),
      })
    }

    expect(
      resolveQuestionDefinition({
        key: "custom-profile",
        text: "How do you approach learning?",
        category: "custom",
      }),
    ).toMatchObject({
      requiresStory: false,
      evidenceTags: expect.arrayContaining(["custom", "profile"]),
    })
  })

  it("keeps story-style custom prompts story-required and opinion prompts profile-based", () => {
    for (const text of [
      "Walk me through a situation where you disagreed with a teammate.",
      "Share an example of how you handled a difficult change.",
      "Have you ever had to lead a team through uncertainty?",
      "What did you do when priorities shifted suddenly?",
    ]) {
      expect(
        resolveQuestionDefinition({
          key: "custom-story",
          text,
          category: "custom",
        }).requiresStory,
      ).toBe(true)
    }

    expect(
      resolveQuestionDefinition({
        key: "custom-motivation",
        text: "What kind of work motivates you?",
        category: "custom",
      }),
    ).toMatchObject({
      requiresStory: false,
    })

    expect(
      resolveQuestionDefinition({
        key: "custom-mixed-strengths",
        text: "What are your greatest strengths? Give an example.",
        category: "custom",
      }).requiresStory,
    ).toBe(true)
    expect(
      resolveQuestionDefinition({
        key: "custom-mixed-role",
        text: "Why do you want this role? Tell me about a time you demonstrated that interest.",
        category: "custom",
      }).requiresStory,
    ).toBe(true)
    expect(
      resolveQuestionDefinition({
        key: "custom-strengths-profile",
        text: "What are your greatest strengths?",
        category: "custom",
      }).requiresStory,
    ).toBe(false)
  })

  it("recognises representative custom competency wording", () => {
    for (const text of [
      "Describe a conflict with a teammate.",
      "Tell me about a challenge you overcame.",
      "What achievement are you most proud of?",
      "How have you handled a difficult deadline?",
      "Give me an example of working with others.",
    ]) {
      expect(
        resolveQuestionDefinition({
          key: "custom-competency",
          text,
          category: "custom",
        }).requiresStory,
      ).toBe(true)
    }

    expect(
      resolveQuestionDefinition({
        key: "custom-opinion",
        text: "What kind of work motivates you?",
        category: "custom",
      }).requiresStory,
    ).toBe(false)
  })

  it("uses built-in policy for persisted questions with different database keys", () => {
    expect(
      resolveQuestionDefinition({
        key: "db-question-123",
        text: "What achievement are you most proud of?",
        category: "strengths",
      }),
    ).toMatchObject({
      requiresStory: true,
      evidenceTags: expect.arrayContaining(["strengths", "achievement"]),
    })

    expect(
      resolveQuestionDefinition({
        key: "db-question-456",
        text: "Tell me about yourself.",
        category: "opening",
      }),
    ).toMatchObject({
      requiresStory: false,
      evidenceTags: expect.arrayContaining(["opening", "profile"]),
    })
  })
})

describe("evidence rules", () => {
  it("requires a confirmed story for competency questions", () => {
    expect(
      assessEvidence(leadershipQuestion, confirmedFacts, [], NOW),
    ).toMatchObject({
      sufficient: false,
      reason: "story_required",
    })
  })

  it("uses confirmed profile facts for tell-me-about-yourself", () => {
    expect(
      assessEvidence(openingQuestion, confirmedFacts, [], NOW),
    ).toMatchObject({
      sufficient: true,
    })
  })

  it("uses schema-shaped fact categories as exact opening evidence", () => {
    const facts: ProfileFactEvidence[] = [
      {
        id: "summary-fact",
        category: "summary",
        label: "Profile summary",
        detail: "Software engineer focused on useful products.",
        tags: [],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:summary:profile-summary:summary-fact",
        isCurrentSource: true,
      },
      {
        id: "experience-fact",
        category: "experience",
        label: "Assistant at Example",
        detail: "Supported weekly reporting.",
        tags: [],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:experience:assistant-at-example:experience-fact",
        isCurrentSource: true,
      },
    ]

    expect(assessEvidence(openingQuestion, facts, [], NOW)).toMatchObject({
      sufficient: true,
    })
    expect(selectEvidence(openingQuestion, facts, [], NOW).factIds).toEqual(
      expect.arrayContaining(["experience-fact", "summary-fact"]),
    )
    expect(selectEvidence(openingQuestion, facts, [], NOW).factIds).toHaveLength(2)
  })

  it("selects schema-shaped skill and project categories for profile questions", () => {
    const facts: ProfileFactEvidence[] = [
      {
        id: "skill-fact",
        category: "skill",
        label: "TypeScript",
        detail: "TypeScript",
        tags: [],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:skill:typescript:skill-fact",
        isCurrentSource: true,
      },
      {
        id: "project-fact",
        category: "project",
        label: "JobClock",
        detail: "Job search assistant.",
        tags: [],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:project:jobclock:project-fact",
        isCurrentSource: true,
      },
    ]
    const strengthsQuestion = commonQuestion("greatest-strengths")

    expect(selectEvidence(motivationQuestion, facts, [], NOW).factIds).toEqual([
      "project-fact",
      "skill-fact",
    ])
    expect(selectEvidence(strengthsQuestion, facts, [], NOW).factIds).toEqual([
      "project-fact",
      "skill-fact",
    ])
  })

  it("never selects unconfirmed facts or stories", () => {
    const result = selectEvidence(
      customQuestion,
      unconfirmedFacts,
      unconfirmedStories,
      NOW,
    )

    expect(result.factIds).toEqual([])
    expect(result.storyIds).toEqual([])
  })

  it("excludes stale confirmed profile facts and keeps current manual facts eligible", () => {
    const question = openingQuestion
    const facts: ProfileFactEvidence[] = [
      {
        id: "stale-cv-fact",
        category: "summary",
        label: "Profile summary",
        detail: "Software engineer building useful web products.",
        tags: ["opening", "profile"],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:summary:profile-summary:stale",
        isCurrentSource: false,
      },
      {
        id: "current-manual-fact",
        category: "opening",
        label: "Career direction",
        detail: "Building useful products for students.",
        tags: ["opening", "profile"],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "manual",
        sourceRef: "manual:career-direction",
        isCurrentSource: true,
      },
    ]

    expect(selectEvidence(question, facts, [], NOW).factIds).toEqual([
      "current-manual-fact",
    ])
  })

  it("keeps confirmed manual facts eligible even when the current-source flag is false", () => {
    const facts: ProfileFactEvidence[] = [
      {
        id: "manual-fact",
        category: "summary",
        label: "Profile summary",
        detail: "Software engineer building useful web products.",
        tags: ["opening", "profile"],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "manual",
        sourceRef: "manual:profile-summary",
        isCurrentSource: false,
      },
    ]

    expect(selectEvidence(openingQuestion, facts, [], NOW).factIds).toEqual([
      "manual-fact",
    ])
  })

  it("keeps confirmed manual facts eligible even when the current-source flag is false", () => {
    const facts: ProfileFactEvidence[] = [
      {
        id: "manual-fact",
        category: "summary",
        label: "Profile summary",
        detail: "Software engineer building useful web products.",
        tags: ["opening", "profile"],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "manual",
        sourceRef: "manual:profile-summary",
        isCurrentSource: false,
      },
    ]

    expect(selectEvidence(openingQuestion, facts, [], NOW).factIds).toEqual([
      "manual-fact",
    ])
  })

  it("ranks exact category and tag matches ahead of eligible text matches", () => {
    const question: QuestionDefinition = {
      key: "leadership-example",
      text: "Describe your leadership approach.",
      category: "leadership",
      requiresStory: true,
      evidenceTags: ["initiative"],
    }
    const facts: ProfileFactEvidence[] = [
      {
        id: "text-match",
        category: "skill",
        label: "Leadership communication",
        detail: "An initiative that improved communication.",
        tags: [],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:skill:leadership-communication:text-match",
        isCurrentSource: true,
      },
      {
        id: "exact-tag",
        category: "experience",
        label: "Student project",
        detail: "Coordinated a release.",
        tags: ["initiative"],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:experience:student-project:exact-tag",
        isCurrentSource: true,
      },
      {
        id: "exact-category",
        category: "leadership",
        label: "Course representative",
        detail: "Organised feedback.",
        tags: [],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:leadership:course-representative:exact-category",
        isCurrentSource: true,
      },
    ]

    expect(selectEvidence(question, facts, [], NOW).factIds).toEqual([
      "exact-category",
      "exact-tag",
      "text-match",
    ])
  })

  it("matches category, tags, and text case-insensitively", () => {
    const question: QuestionDefinition = {
      key: "case-insensitive-leadership",
      text: "Describe MENTORING others.",
      category: "leadership",
      requiresStory: true,
      evidenceTags: ["initiative"],
    }
    const facts: ProfileFactEvidence[] = [
      {
        id: "category-match",
        category: "LEADERSHIP",
        label: "Course representative",
        detail: "Coordinated feedback.",
        tags: [],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:leadership:course-representative:category-match",
        isCurrentSource: true,
      },
      {
        id: "tag-match",
        category: "experience",
        label: "Student project",
        detail: "Coordinated a release.",
        tags: ["INITIATIVE"],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:experience:student-project:tag-match",
        isCurrentSource: true,
      },
      {
        id: "text-match",
        category: "experience",
        label: "Mentoring initiative",
        detail: "Mentoring classmates through an initiative.",
        tags: [],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:experience:mentoring-initiative:text-match",
        isCurrentSource: true,
      },
    ]

    expect(selectEvidence(question, facts, [], NOW).factIds).toEqual([
      "category-match",
      "tag-match",
      "text-match",
    ])
  })

  it("does not make generic wording sufficient for a motivation question", () => {
    const genericFacts: ProfileFactEvidence[] = [
      {
        id: "generic-1",
        category: "experience",
        label: "I want this",
        detail: "This is something I want.",
        tags: [],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:experience:i-want-this:generic-1",
        isCurrentSource: true,
      },
      {
        id: "generic-2",
        category: "education",
        label: "Want this role",
        detail: "I want this opportunity.",
        tags: [],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:education:want-this-role:generic-2",
        isCurrentSource: true,
      },
    ]

    expect(
      assessEvidence(motivationQuestion, genericFacts, [], NOW),
    ).toMatchObject({
      sufficient: false,
      reason: "profile_required",
    })
    expect(selectEvidence(motivationQuestion, genericFacts, [], NOW).factIds).toEqual(
      [],
    )
  })

  it("keeps exact category and tag matches eligible", () => {
    const question: QuestionDefinition = {
      key: "persisted-motivation",
      text: "Why are you interested?",
      category: "motivation",
      requiresStory: false,
      evidenceTags: ["career-interest"],
    }
    const facts: ProfileFactEvidence[] = [
      {
        id: "category-match",
        category: "motivation",
        label: "Career direction",
        detail: "Building accessible products.",
        tags: [],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:motivation:career-direction:category-match",
        isCurrentSource: true,
      },
      {
        id: "tag-match",
        category: "project",
        label: "Portfolio",
        detail: "A personal web project.",
        tags: ["career-interest"],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:project:portfolio:tag-match",
        isCurrentSource: true,
      },
    ]

    expect(selectEvidence(question, facts, [], NOW).factIds).toEqual([
      "category-match",
      "tag-match",
    ])
  })

  it("requires two meaningful overlaps for text-only evidence", () => {
    const question: QuestionDefinition = {
      key: "collaboration-communication",
      text: "How do you approach collaboration and communication?",
      category: "custom",
      requiresStory: false,
      evidenceTags: [],
    }
    const facts: ProfileFactEvidence[] = [
      {
        id: "one-overlap",
        category: "experience",
        label: "Communication",
        detail: "Shared updates.",
        tags: [],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:experience:communication:one-overlap",
        isCurrentSource: true,
      },
      {
        id: "two-overlaps",
        category: "experience",
        label: "Project collaboration",
        detail: "Used clear communication with classmates.",
        tags: [],
        confirmedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:00:00.000Z",
        sourceType: "cv",
        sourceRef: "cv:experience:project-collaboration:two-overlaps",
        isCurrentSource: true,
      },
    ]

    expect(selectEvidence(question, facts, [], NOW).factIds).toEqual([
      "two-overlaps",
    ])
  })

  it("uses stable IDs to break equal-score ties regardless of input order", () => {
    const equalFacts: ProfileFactEvidence[] = ["fact-z", "fact-a"].map((id) => ({
      id,
      category: "leadership",
      label: "Leadership example",
      detail: "Led a team.",
      tags: [],
      confirmedAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:00:00.000Z",
      sourceType: "cv" as const,
      sourceRef: `cv:leadership:leadership-example:${id}`,
      isCurrentSource: true,
    }))
    const equalStories: StoryEvidence[] = ["story-z", "story-a"].map((id) => ({
      id,
      category: "leadership",
      title: "Leadership example",
      situation: "A team needed direction.",
      task: "Coordinate the work.",
      action: "Led the team.",
      result: "The work was completed.",
      tags: [],
      confirmedAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:00:00.000Z",
    }))

    const forward = selectEvidence(
      leadershipQuestion,
      equalFacts,
      equalStories,
      NOW,
    )
    const reversed = selectEvidence(
      leadershipQuestion,
      [...equalFacts].reverse(),
      [...equalStories].reverse(),
      NOW,
    )

    expect(forward.factIds).toEqual(["fact-a", "fact-z"])
    expect(forward.storyIds).toEqual(["story-a", "story-z"])
    expect(reversed).toEqual(forward)
  })

  it("caps selected evidence at six facts and three stories", () => {
    const facts: ProfileFactEvidence[] = Array.from({ length: 8 }, (_, index) => ({
      id: `fact-${index}`,
      category: "leadership",
      label: `Leadership fact ${index}`,
      detail: "Led a project.",
      tags: ["initiative"],
      confirmedAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:00:00.000Z",
      sourceType: "cv" as const,
      sourceRef: `cv:leadership:leadership-fact-${index}:fact-${index}`,
      isCurrentSource: true,
    }))
    const stories = Array.from({ length: 5 }, (_, index) => ({
      id: `story-${index}`,
      category: "leadership",
      title: `Leadership story ${index}`,
      situation: "A project team needed direction.",
      task: "Coordinate the release.",
      action: "Led the project team.",
      result: "The team completed the release.",
      tags: ["initiative"],
      confirmedAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-06-01T10:00:00.000Z",
    }))

    const selected = selectEvidence(leadershipQuestion, facts, stories, NOW)

    expect(selected.factIds).toHaveLength(6)
    expect(selected.storyIds).toHaveLength(3)
  })

  it("selects deterministic IDs and accepts an explicit generation time", () => {
    const first = selectEvidence(
      openingQuestion,
      confirmedFacts,
      [],
      "2026-06-15T12:00:00.000Z",
    )
    const second = selectEvidence(
      openingQuestion,
      confirmedFacts,
      [],
      "2026-06-15T12:00:00.000Z",
    )

    expect(first).toEqual(second)
    expect(first.generatedAt).toBe("2026-06-15T12:00:00.000Z")
  })

  it("requires at least two confirmed relevant facts for profile questions", () => {
    expect(
      assessEvidence(
        openingQuestion,
        [
          confirmedFacts[0],
          {
            id: "irrelevant",
            category: "language",
            label: "French",
            detail: "French",
            tags: [],
            confirmedAt: "2026-06-01T10:00:00.000Z",
            updatedAt: "2026-06-01T10:00:00.000Z",
            sourceType: "cv",
            sourceRef: "cv:language:french:irrelevant",
            isCurrentSource: true,
          },
        ],
        [],
        NOW,
      ),
    ).toMatchObject({
      sufficient: false,
      reason: "profile_required",
    })
  })

  it("returns non-empty category-specific discovery prompts", () => {
    const leadershipPrompts = discoveryPromptsFor("leadership")
    const motivationPrompts = discoveryPromptsFor("motivation")

    expect(leadershipPrompts.length).toBeGreaterThanOrEqual(2)
    expect(leadershipPrompts.length).toBeLessThanOrEqual(4)
    expect(leadershipPrompts.every((prompt) => prompt.trim().length > 0)).toBe(
      true,
    )
    expect(leadershipPrompts).not.toEqual(motivationPrompts)
    expect(leadershipPrompts.join(" ").toLowerCase()).toMatch(
      /university|project|volunteer|team/,
    )
    expect(motivationPrompts.join(" ").toLowerCase()).toMatch(
      /role|learning|job search|project/,
    )
  })

  it("provides practical non-fabrication prompts for every category", () => {
    const categories: InterviewQuestionCategory[] = [
      "opening",
      "motivation",
      "strengths",
      "resilience",
      "teamwork",
      "leadership",
      "initiative",
      "pressure",
      "mistakes",
      "custom",
    ]

    for (const category of categories) {
      const prompts = discoveryPromptsFor(category)
      expect(prompts.length).toBeGreaterThanOrEqual(2)
      expect(prompts.length).toBeLessThanOrEqual(4)
      expect(prompts.every((prompt) => prompt.trim().length > 0)).toBe(true)
      expect(prompts.join(" ").toLowerCase()).not.toMatch(
        /\b(?:invent|make up|pretend)\b/,
      )
    }
  })
})
