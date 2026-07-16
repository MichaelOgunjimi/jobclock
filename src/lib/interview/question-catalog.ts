import type {
  InterviewQuestionCategory,
  QuestionDefinition,
} from "./types"

interface QuestionPolicyInput {
  key: string
  text: string
  category: InterviewQuestionCategory
  requiresStory?: boolean
  evidenceTags?: string[]
}

const CATEGORY_EVIDENCE_TAGS: Record<
  InterviewQuestionCategory,
  string[]
> = {
  opening: [
    "opening",
    "profile",
    "summary",
    "experience",
    "education",
    "project",
    "skill",
  ],
  motivation: ["motivation", "career", "interest", "project", "skill"],
  strengths: ["strengths", "skill", "experience", "project", "achievement"],
  resilience: ["resilience", "challenge", "problem-solving", "adaptability"],
  teamwork: ["teamwork", "conflict", "collaboration", "communication"],
  leadership: ["leadership", "initiative", "ownership", "teamwork"],
  initiative: ["initiative", "ownership", "service", "effort"],
  pressure: ["pressure", "deadline", "prioritisation", "resilience"],
  mistakes: ["mistakes", "learning", "reflection", "accountability"],
  custom: ["custom"],
}

const PROFILE_CATEGORIES = new Set<InterviewQuestionCategory>([
  "opening",
  "motivation",
  "strengths",
])

const CUSTOM_STORY_PATTERNS = [
  /\btell me about a time\b/i,
  /\bwalk me through a situation\b/i,
  /\bshare an example\b/i,
  /\bgive(?: me)? an example\b/i,
  /\bwhat did you do when\b/i,
  /\bhave you ever had to\b/i,
  /\bdescribe a time\b/i,
  /\bwhen have you\b/i,
  /\bhow have you\b/i,
]

const CUSTOM_PROFILE_PATTERNS = [
  /\btell me about yourself\b/i,
  /\bintroduce yourself\b/i,
  /\bwalk me through yourself\b/i,
  /\bwhy(?: do you want| are you interested in| this)?(?: this)? (?:role|job|position|company)\b/i,
  /\bwhat kind of work motivates you\b/i,
  /\bwhat motivates you\b/i,
  /\bwhat interests you\b/i,
  /\bwhat kind of projects interest you\b/i,
  /\bhow do you approach learning\b/i,
  /\bwhat are your (?:greatest )?strengths\b/i,
  /\bwhat are your development areas\b/i,
  /\bwhat would you like to improve\b/i,
  /\bwhat are you working to improve\b/i,
  /\bwhat are your career goals\b/i,
  /\bwhere do you see yourself\b/i,
  /\bwhat are your future plans\b/i,
  /\bwhat does your future look like\b/i,
]

const COMMON_QUESTION_INPUTS: QuestionPolicyInput[] = [
  {
    key: "tell-me-about-yourself",
    text: "Tell me about yourself.",
    category: "opening",
  },
  {
    key: "why-this-role",
    text: "Why do you want this role?",
    category: "motivation",
  },
  {
    key: "greatest-strengths",
    text: "What are your greatest strengths?",
    category: "strengths",
  },
  {
    key: "challenge-overcome",
    text: "Tell me about a challenge you overcame.",
    category: "resilience",
  },
  {
    key: "conflict-with-teammate",
    text: "Describe a conflict with a teammate.",
    category: "teamwork",
  },
  {
    key: "lead-or-take-initiative",
    text: "Tell me about a time you led or took initiative.",
    category: "leadership",
  },
  {
    key: "mistake-and-learning",
    text: "Tell me about a mistake and what you learned.",
    category: "mistakes",
  },
  {
    key: "worked-under-pressure",
    text: "Tell me about a time you worked under pressure.",
    category: "pressure",
  },
  {
    key: "went-the-extra-mile",
    text: "Tell me about a time you went the extra mile.",
    category: "initiative",
  },
  {
    key: "proudest-achievement",
    text: "What achievement are you most proud of?",
    category: "strengths",
    requiresStory: true,
    evidenceTags: ["impact", "results"],
  },
]

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags)]
}

function normalizeQuestionText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function builtInQuestionKey(
  category: InterviewQuestionCategory,
  text: string,
): string {
  return `${category}|${normalizeQuestionText(text)}`
}

const BUILT_IN_QUESTION_POLICY = new Map(
  COMMON_QUESTION_INPUTS.map((question) => [
    builtInQuestionKey(question.category, question.text),
    question,
  ]),
)

export function resolveQuestionDefinition(input: {
  key: string
  text: string
  category: InterviewQuestionCategory
}): QuestionDefinition {
  const builtIn = BUILT_IN_QUESTION_POLICY.get(
    builtInQuestionKey(input.category, input.text),
  )
  const customMatchesStory =
    input.category === "custom" &&
    CUSTOM_STORY_PATTERNS.some((pattern) => pattern.test(input.text))
  const customMatchesProfile =
    input.category === "custom" &&
    CUSTOM_PROFILE_PATTERNS.some((pattern) => pattern.test(input.text))
  const requiresStory =
    builtIn?.requiresStory ??
    (input.category === "custom"
      ? customMatchesStory
        ? true
        : customMatchesProfile
          ? false
          : true
      : !PROFILE_CATEGORIES.has(input.category))
  const customTags =
    input.category === "custom"
      ? [requiresStory ? "example" : "profile"]
      : []

  return {
    ...input,
    requiresStory,
    evidenceTags: uniqueTags([
      ...CATEGORY_EVIDENCE_TAGS[input.category],
      ...customTags,
      ...(builtIn?.evidenceTags ?? []),
    ]),
  }
}

export const COMMON_INTERVIEW_QUESTIONS = COMMON_QUESTION_INPUTS.map(
  resolveQuestionDefinition,
)

export const COMMON_INTERVIEW_QUESTIONS_BY_KEY: ReadonlyMap<
  string,
  QuestionDefinition
> = new Map(
  COMMON_INTERVIEW_QUESTIONS.map((question) => [question.key, question]),
)
