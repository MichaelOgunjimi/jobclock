# Personal Interview Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Interview Prep workspace that learns confirmed evidence once, creates editable personal answers, produces separate job-tailored versions, and supports typed practice.

**Architecture:** Keep `/interview` as a server-rendered authenticated entry point and pass serializable workspace data into focused client components. Store confirmed facts, questions, and answer versions in dedicated Drizzle tables while retaining `story_bank` for experiences and `interview_prep` for existing application-specific output. Use authenticated server actions for durable mutations and rate-limited route handlers for AI generation, discovery drafting, and practice evaluation.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript, Drizzle ORM/PostgreSQL, Supabase Auth, Vitest/Testing Library, existing AI provider abstraction, Tailwind CSS 4/Base UI.

---

## Source Design And Required Reading

Implement against:

- `docs/superpowers/specs/2026-06-15-personal-interview-prep-design.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`
- `src/app/(dashboard)/interview/page.tsx`
- `src/app/(dashboard)/interview/actions.ts`
- `src/app/(dashboard)/interview/story-bank.tsx`
- `src/app/(dashboard)/applications/[id]/interview/page.tsx`
- `src/lib/db/schema.ts`
- `src/lib/prompts/interview.ts`

Next.js 16 Server Functions are directly reachable POST endpoints. Every new action and route must authenticate and authorize the referenced question, answer, story, fact, and application on the server.

## Delivery Slices

1. **Foundation:** persistence, catalogue, confirmed evidence, and safe imports.
2. **Answer Library:** questions, full general answers, editing, and saving.
3. **Coaching:** evidence discovery, job tailoring, and typed practice.
4. **Integration:** Story Bank/About Me polish and application question import.

Each slice must leave the app buildable and its focused tests passing.

## File Structure

Create:

- `src/lib/interview/types.ts`: shared serializable domain types.
- `src/lib/interview/question-catalog.ts`: built-in common and competency questions.
- `src/lib/interview/profile-facts.ts`: deterministic CV-to-fact draft extraction.
- `src/lib/interview/evidence.ts`: evidence selection and sufficiency decisions.
- `src/lib/interview/prompts.ts`: general, tailored, discovery, and evaluation prompts.
- `src/lib/interview/parse-generation.ts`: Zod-backed parsing of structured AI output.
- `src/lib/interview/starter-import.ts`: parser and idempotent records for the supplied six answers.
- `src/lib/interview/*.test.ts`: focused domain tests.
- `src/app/(dashboard)/interview/data.ts`: authenticated workspace read model.
- `src/app/(dashboard)/interview/interview-workspace.tsx`: tab shell and shared state.
- `src/app/(dashboard)/interview/question-library.tsx`: question browsing and custom question creation.
- `src/app/(dashboard)/interview/answer-composer.tsx`: answer generation, edit, save, and job tailoring.
- `src/app/(dashboard)/interview/evidence-discovery.tsx`: one-prompt-at-a-time discovery and confirmation.
- `src/app/(dashboard)/interview/about-me-editor.tsx`: CV fact preview, confirmation, edit, and deletion.
- `src/app/(dashboard)/interview/practice-session.tsx`: typed practice and feedback.
- `src/app/(dashboard)/interview/*.test.tsx`: component behavior tests.
- `src/app/api/interview/answers/generate/route.ts`: grounded general/tailored answer generation.
- `src/app/api/interview/answers/generate/route.test.ts`: generation route security and behavior.
- `src/app/api/interview/discovery/draft/route.ts`: convert discovery responses into a reviewable story.
- `src/app/api/interview/discovery/draft/route.test.ts`: discovery parsing and no-persistence tests.
- `src/app/api/interview/practice/evaluate/route.ts`: optional-job practice evaluation.
- `src/app/api/interview/practice/evaluate/route.test.ts`: practice authorization and prompt tests.
- `scripts/import-personal-interview-starters.ts`: user-targeted import CLI.
- `src/lib/interview/starter-import-cli.test.ts`: CLI argument and dry-run tests.
- `tests/e2e/interview-prep.spec.ts`: complete user workflow.
- `src/app/interview-test-harness/page.tsx`: runtime-gated Playwright harness.
- `src/app/interview-test-harness/interview-test-harness-client.tsx`: local action adapter for E2E.

Modify:

- `src/lib/db/schema.ts`: add interview tables and story confirmation metadata.
- `drizzle/migrations/0019_personal_interview_prep.sql`: generated migration.
- `drizzle/migrations/meta/0019_snapshot.json`: generated schema snapshot.
- `drizzle/migrations/meta/_journal.json`: generated journal entry.
- `src/app/(dashboard)/interview/page.tsx`: load and render the new workspace.
- `src/app/(dashboard)/interview/actions.ts`: authenticated mutations.
- `src/app/(dashboard)/interview/story-bank.tsx`: confirmation state and answer references.
- `src/app/(dashboard)/applications/[id]/interview/page.tsx`: save generated questions to the library.
- `src/app/(dashboard)/applications/[id]/interview/page.test.tsx`: application bridge behavior.
- `package.json`: add the targeted starter import command.
- `playwright.config.ts`: enable the runtime-gated interview test harness.

Do not replace or rewrite the existing application-specific generation handlers. The new workspace consumes their saved questions through an explicit import action.

### Task 1: Add Interview Persistence And Story Confirmation

**Files:**

- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/migrations/0019_personal_interview_prep.sql`
- Create: `drizzle/migrations/meta/0019_snapshot.json`
- Modify: `drizzle/migrations/meta/_journal.json`

- [ ] **Step 1: Add schema definitions**

Extend `storyBank` and add the three tables below. Use `AnyPgColumn` for the application self-reference pattern already used in this schema.

```ts
export const interviewProfileFacts = pgTable(
  "interview_profile_facts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    category: text("category").notNull(),
    label: text("label").notNull(),
    detail: text("detail").notNull(),
    sourceType: text("source_type").notNull(),
    sourceRef: text("source_ref"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("interview_profile_facts_user_id_idx").on(table.userId),
    uniqueIndex("interview_profile_facts_user_source_unique")
      .on(table.userId, table.sourceType, table.sourceRef),
  ],
)

export const interviewQuestions = pgTable(
  "interview_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    applicationId: uuid("application_id").references(
      (): AnyPgColumn => applications.id,
      { onDelete: "cascade" },
    ),
    text: text("text").notNull(),
    category: text("category").notNull(),
    sourceType: text("source_type").notNull(),
    sourceRef: text("source_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("interview_questions_user_id_idx").on(table.userId),
    index("interview_questions_application_id_idx").on(table.applicationId),
  ],
)

export const interviewAnswers = pgTable(
  "interview_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => interviewQuestions.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(
      (): AnyPgColumn => applications.id,
      { onDelete: "cascade" },
    ),
    content: text("content").notNull(),
    evidenceSnapshot: jsonb("evidence_snapshot").notNull().default({}),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("interview_answers_user_id_idx").on(table.userId),
    uniqueIndex("interview_answers_saved_general_unique")
      .on(table.userId, table.questionId)
      .where(sql`${table.applicationId} is null and ${table.status} = 'saved'`),
    uniqueIndex("interview_answers_saved_tailored_unique")
      .on(table.userId, table.questionId, table.applicationId)
      .where(sql`${table.applicationId} is not null and ${table.status} = 'saved'`),
  ],
)
```

Add these fields to `storyBank`:

```ts
sourceType: text("source_type").notNull().default("manual"),
sourceRef: text("source_ref"),
confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
```

Manual creation will set `confirmedAt` immediately. Existing rows stay unconfirmed so generic examples cannot silently become evidence.

- [ ] **Step 2: Generate the named migration**

Run:

```bash
npm run db:generate -- --name=personal_interview_prep
```

Expected:

- `drizzle/migrations/0019_personal_interview_prep.sql` creates the three tables and indexes.
- The migration adds `source_type`, `source_ref`, and nullable `confirmed_at` to `story_bank`.
- Drizzle updates `0019_snapshot.json` and `_journal.json`.

- [ ] **Step 3: Inspect the generated SQL**

Run:

```bash
rg -n "interview_profile_facts|interview_questions|interview_answers|confirmed_at|saved_general|saved_tailored" \
  drizzle/migrations/0019_personal_interview_prep.sql
```

Expected: all three tables, story confirmation column, foreign keys, and both partial unique indexes are present.

- [ ] **Step 4: Verify schema compilation**

Run:

```bash
npx tsc --noEmit
```

Expected: exit code `0`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts drizzle/migrations/0019_personal_interview_prep.sql \
  drizzle/migrations/meta/0019_snapshot.json drizzle/migrations/meta/_journal.json
printf '%s\n' \
  'feat(db): add personal interview prep records' \
  '' \
  '- Add confirmed profile facts, questions, and answer versions' \
  '- Track Story Bank confirmation and source metadata' \
  '- Enforce separate saved general and tailored answers' > /tmp/cm.txt
git commit -F /tmp/cm.txt
rm /tmp/cm.txt
```

### Task 2: Define Questions, Profile Facts, And Evidence Rules

**Files:**

- Create: `src/lib/interview/types.ts`
- Create: `src/lib/interview/question-catalog.ts`
- Create: `src/lib/interview/profile-facts.ts`
- Create: `src/lib/interview/profile-facts.test.ts`
- Create: `src/lib/interview/evidence.ts`
- Create: `src/lib/interview/evidence.test.ts`

- [ ] **Step 1: Write failing CV fact extraction tests**

Test that a normalized CV creates unconfirmed drafts without inventing prose:

```ts
it("extracts deterministic education, experience, and project drafts", () => {
  const drafts = extractProfileFactDrafts({
    education: [{ degree: "MSc AI", institution: "University of Manchester", start_date: "2024", end_date: "2025" }],
    experience: [{ title: "Assistant", company: "Example", start_date: "2023", end_date: "2024", highlights: ["Supported weekly reporting"] }],
    projects: [{ name: "JobClock", description: "Job search assistant", technologies: ["Next.js"], highlights: [] }],
    skills: ["TypeScript"],
    languages: [],
    certifications: [],
    activities: [],
  })

  expect(drafts).toEqual(expect.arrayContaining([
    expect.objectContaining({ category: "education", label: "MSc AI", sourceType: "cv" }),
    expect.objectContaining({ category: "experience", label: "Assistant at Example" }),
    expect.objectContaining({ category: "project", label: "JobClock" }),
  ]))
  expect(drafts.every((draft) => draft.confirmedAt === null)).toBe(true)
})
```

- [ ] **Step 2: Write failing evidence tests**

Cover competency and non-competency behavior:

```ts
it("requires a confirmed story for competency questions", () => {
  expect(assessEvidence(leadershipQuestion, confirmedFacts, [])).toMatchObject({
    sufficient: false,
    reason: "story_required",
  })
})

it("uses confirmed profile facts for tell-me-about-yourself", () => {
  expect(assessEvidence(openingQuestion, confirmedFacts, [])).toMatchObject({
    sufficient: true,
  })
})

it("never selects unconfirmed facts or stories", () => {
  const result = selectEvidence(customQuestion, unconfirmedFacts, unconfirmedStories)
  expect(result.factIds).toEqual([])
  expect(result.storyIds).toEqual([])
})
```

- [ ] **Step 3: Run the focused tests**

Run:

```bash
npm test -- src/lib/interview/profile-facts.test.ts src/lib/interview/evidence.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Implement the domain contracts and catalogue**

Define these stable types in `types.ts`:

```ts
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

export interface QuestionDefinition {
  key: string
  text: string
  category: InterviewQuestionCategory
  requiresStory: boolean
  evidenceTags: string[]
}

export interface EvidenceSnapshot {
  factIds: string[]
  storyIds: string[]
  generatedAt: string
}

export type EvidenceAssessment =
  | { sufficient: true; evidence: EvidenceSnapshot }
  | { sufficient: false; reason: "story_required" | "profile_required"; suggestedPrompts: string[] }
```

Populate `COMMON_INTERVIEW_QUESTIONS` with at least:

- Tell me about yourself.
- Why do you want this role?
- What are your greatest strengths?
- Tell me about a challenge you overcame.
- Describe a conflict with a teammate.
- Tell me about a time you led or took initiative.
- Tell me about a mistake and what you learned.
- Tell me about a time you worked under pressure.
- Tell me about a time you went the extra mile.
- What achievement are you most proud of?

Each competency definition has specific evidence tags and `requiresStory: true`.

- [ ] **Step 5: Implement deterministic CV extraction and evidence selection**

`extractProfileFactDrafts()` must use `sanitizeCvData()` and build only source-derived strings. `selectEvidence()` filters to rows with `confirmedAt`, scores exact category/tag matches first, and caps prompt context at six facts and three stories.

Use explicit sufficiency:

```ts
export function assessEvidence(
  question: QuestionDefinition,
  facts: ProfileFactEvidence[],
  stories: StoryEvidence[],
): EvidenceAssessment {
  const selected = selectEvidence(question, facts, stories)
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
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/lib/interview/profile-facts.test.ts src/lib/interview/evidence.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/interview
printf '%s\n' \
  'feat(interview): add question and evidence domain' \
  '' \
  '- Define the built-in interview question catalogue' \
  '- Extract reviewable facts from parsed CV data' \
  '- Require confirmed evidence before answer generation' > /tmp/cm.txt
git commit -F /tmp/cm.txt
rm /tmp/cm.txt
```

### Task 3: Build The Authenticated Workspace Read Model And Mutations

**Files:**

- Create: `src/app/(dashboard)/interview/data.ts`
- Create: `src/app/(dashboard)/interview/data.test.ts`
- Modify: `src/app/(dashboard)/interview/actions.ts`
- Create: `src/app/(dashboard)/interview/actions.test.ts`

- [ ] **Step 1: Write failing ownership tests**

Test these exported operations:

```ts
await expect(createQuestion({ text: "", category: "custom" })).resolves.toEqual({
  error: "Question is required",
})

await expect(saveAnswer({
  questionId: "question-owned",
  applicationId: null,
  content: "My answer",
  evidenceSnapshot: { factIds: [], storyIds: [], generatedAt: "2026-06-15T00:00:00.000Z" },
})).resolves.toEqual(expect.objectContaining({ id: "answer-1" }))

await expect(saveAnswer({
  questionId: "question-other-user",
  applicationId: null,
  content: "My answer",
  evidenceSnapshot: emptyEvidence,
})).resolves.toEqual({ error: "Question not found" })
```

Also assert:

- an application from another user is rejected;
- `confirmProfileFacts` inserts only selected CV drafts;
- `confirmDiscoveredStory` sets `confirmedAt`;
- `deleteProfileFact` includes both fact ID and authenticated user ID;
- saving a tailored answer does not update the general row.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- 'src/app/(dashboard)/interview/data.test.ts' \
  'src/app/(dashboard)/interview/actions.test.ts'
```

Expected: FAIL because the read model and actions are missing.

- [ ] **Step 3: Implement `loadInterviewWorkspace(userId)`**

Return one serializable object:

```ts
export interface InterviewWorkspaceData {
  questions: InterviewQuestionView[]
  answers: InterviewAnswerView[]
  facts: InterviewProfileFactView[]
  stories: StoryEntry[]
  applications: Array<{ id: string; title: string; company: string }>
  cvFactDrafts: ProfileFactDraft[]
}
```

Load independent queries with `Promise.all`. Query `applications` by `userId`, left join `jobsCache`, and query the primary CV by `userId`. Merge built-in catalogue entries with materialized questions by `sourceRef`, but do not insert built-ins during page load.

- [ ] **Step 4: Implement authenticated actions**

Keep `getAuthenticatedUserId()` private and add:

```ts
export async function createQuestion(input: {
  text: string
  category: InterviewQuestionCategory
  sourceType?: "custom" | "built_in" | "application_generated"
  sourceRef?: string
  applicationId?: string | null
}): Promise<{ id: string } | { error: string }>

export async function saveAnswer(input: {
  questionId: string
  applicationId: string | null
  content: string
  evidenceSnapshot: EvidenceSnapshot
}): Promise<{ id: string } | { error: string }>

export async function confirmProfileFacts(
  drafts: ProfileFactDraft[],
): Promise<{ inserted: number } | { error: string }>

export async function updateProfileFact(
  id: string,
  input: { category: string; label: string; detail: string },
): Promise<{ error?: string }>

export async function deleteProfileFact(
  id: string,
): Promise<{ error?: string }>

export async function confirmStory(
  id: string,
): Promise<{ error?: string }>

export async function confirmDiscoveredStory(input: {
  title: string
  situation: string
  task: string
  action: string
  result: string
  tags: string[]
}): Promise<{ id: string } | { error: string }>
```

Use a transaction for `saveAnswer`: demote the existing saved answer in the same general/tailored context to `draft`, then insert the new saved row. Verify question and optional application ownership before the transaction.

When building `StoryEntry`, count answer snapshots that reference each story ID. Mark an answer `evidenceStale` when a referenced fact/story no longer exists or has `updatedAt` later than `evidenceSnapshot.generatedAt`.

Update existing `createStory()` so manually entered stories set:

```ts
sourceType: "manual",
confirmedAt: new Date(),
```

Remove `importSampleStories()` from the user-facing action surface.

- [ ] **Step 5: Revalidate the workspace**

Every successful mutation calls:

```ts
revalidatePath("/interview")
```

Application question imports also call:

```ts
revalidatePath(`/applications/${applicationId}/interview`)
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- 'src/app/(dashboard)/interview/data.test.ts' \
  'src/app/(dashboard)/interview/actions.test.ts'
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add 'src/app/(dashboard)/interview/data.ts' \
  'src/app/(dashboard)/interview/data.test.ts' \
  'src/app/(dashboard)/interview/actions.ts' \
  'src/app/(dashboard)/interview/actions.test.ts'
printf '%s\n' \
  'feat(interview): add secure workspace data actions' \
  '' \
  '- Load questions, answers, facts, stories, CV drafts, and applications' \
  '- Enforce resource ownership in every mutation' \
  '- Save general and tailored answer versions independently' > /tmp/cm.txt
git commit -F /tmp/cm.txt
rm /tmp/cm.txt
```

### Task 4: Add The User-Targeted Six-Answer Import

**Files:**

- Create: `src/lib/interview/starter-import.ts`
- Create: `src/lib/interview/starter-import.test.ts`
- Create: `src/lib/interview/starter-import-cli.test.ts`
- Create: `scripts/import-personal-interview-starters.ts`
- Modify: `package.json`

- [ ] **Step 1: Write parser and idempotence tests**

Use the supplied source file:

`/Users/michael/.codex/attachments/05526faa-fb7e-4bd5-8d36-10f785e4d05b/pasted-text.txt`

Test:

```ts
const starters = parseStarterAnswers(sourceText)
expect(starters).toHaveLength(6)
expect(starters[0]).toMatchObject({
  sourceRef: "personal-starter:challenge-overcome",
  question: "Tell me about a challenge you overcame.",
  category: "resilience",
})
expect(starters[0].answer).toContain("relocated from Nigeria to the UK")
```

Test that the import skips records whose `sourceRef` already exists.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/interview/starter-import.test.ts \
  src/lib/interview/starter-import-cli.test.ts
```

Expected: FAIL because parser and script do not exist.

- [ ] **Step 3: Implement a strict six-section parser**

Map headings `1` through `6` to stable question text and categories. Strip surrounding markdown quote markers and preserve the answer wording. Derive draft STAR fields conservatively:

```ts
const STARTER_DEFINITIONS = [
  { number: 1, key: "challenge-overcome", question: "Tell me about a challenge you overcame.", category: "resilience" },
  { number: 2, key: "conflict", question: "Describe a conflict with a teammate.", category: "teamwork" },
  { number: 3, key: "initiative", question: "Tell me about a time you led or took initiative.", category: "initiative" },
  { number: 4, key: "mistake", question: "Tell me about a mistake and what you learned.", category: "mistakes" },
  { number: 5, key: "pressure", question: "Tell me about a time you worked under pressure.", category: "pressure" },
  { number: 6, key: "proud-win", question: "What achievement are you most proud of?", category: "strengths" },
] as const

const SECTION_HEADING = /^\*\*(?<number>[1-6])\.\s+.+\*\*$/
```

- `situation`: first paragraph;
- `task`: second paragraph;
- `action`: middle action paragraphs;
- `result`: final outcome and learning paragraphs;
- `confirmedAt`: `null`.

Do not use AI for this import.

- [ ] **Step 4: Implement the targeted CLI**

The command requires both an account email and source path:

```bash
npm run interview:import-starters -- \
  --email michael@example.com \
  --source /absolute/path/pasted-text.txt
```

Behavior:

1. Resolve exactly one profile by email.
2. Parse six starters.
3. Insert missing draft stories, materialized questions, and draft answers in one transaction.
4. Use stable `sourceRef` values to make the operation idempotent.
5. Print counts for inserted and skipped records.
6. Exit non-zero if the email is missing, ambiguous, or not found.

Add:

```json
"interview:import-starters": "tsx scripts/import-personal-interview-starters.ts"
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- src/lib/interview/starter-import.test.ts \
  src/lib/interview/starter-import-cli.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/interview/starter-import.ts \
  src/lib/interview/starter-import.test.ts \
  src/lib/interview/starter-import-cli.test.ts \
  scripts/import-personal-interview-starters.ts \
  package.json
printf '%s\n' \
  'feat(interview): add targeted personal answer import' \
  '' \
  '- Parse the six approved answers into reviewable drafts' \
  '- Require an explicit account email for import' \
  '- Make repeated imports idempotent with stable source references' > /tmp/cm.txt
git commit -F /tmp/cm.txt
rm /tmp/cm.txt
```

### Task 5: Generate Grounded General And Job-Tailored Answers

**Files:**

- Create: `src/lib/interview/prompts.ts`
- Create: `src/lib/interview/prompts.test.ts`
- Create: `src/app/api/interview/answers/generate/route.ts`
- Create: `src/app/api/interview/answers/generate/route.test.ts`

- [ ] **Step 1: Write failing prompt tests**

```ts
it("keeps job context out of general answers", () => {
  const prompt = buildInterviewAnswerPrompt({ question, evidence, application: null })
  expect(prompt).not.toContain("ACME")
  expect(prompt).toContain("Use only the confirmed evidence")
})

it("adds job requirements without changing evidence", () => {
  const prompt = buildInterviewAnswerPrompt({ question, evidence, application })
  expect(prompt).toContain("Software Engineer at ACME")
  expect(prompt).toContain("Do not add facts, metrics, tools, or outcomes")
})
```

- [ ] **Step 2: Write failing route tests**

Cover:

- 401 when unauthenticated;
- 404 for another user's question;
- 404 for another user's application;
- 409 with `status: "needs_evidence"` when assessment fails;
- 422 when no AI key is configured;
- 200 with `{ content, evidenceSnapshot }` on success;
- generated content is returned but not inserted into `interview_answers`.

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm test -- src/lib/interview/prompts.test.ts \
  src/app/api/interview/answers/generate/route.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement the prompt builder**

The system prompt must include:

```text
Write a first-person interview answer that sounds natural when spoken.
Use only the confirmed evidence provided.
Never invent events, dates, responsibilities, tools, metrics, or outcomes.
Use STAR internally for example-based questions, but do not print STAR headings.
Keep the answer under 250 words.
```

The user prompt serializes selected facts and stories with stable IDs, then adds job title/company/description only when `applicationId` is present.

- [ ] **Step 5: Implement the route**

Use:

```ts
export const maxDuration = 180
```

Validate a Zod request:

```ts
z.object({
  questionId: z.string().uuid(),
  applicationId: z.string().uuid().nullable().optional(),
})
```

Then:

1. Authenticate.
2. Apply `aiGenerateRateLimit`.
3. Load the owned question.
4. Load confirmed facts and stories only.
5. Run `assessEvidence`.
6. If insufficient, return status `409` with suggested prompts.
7. If tailoring, verify and load the owned application plus JD.
8. Resolve the configured AI provider.
9. Generate and normalize plain text.
10. Return content and evidence snapshot without saving.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/lib/interview/prompts.test.ts \
  src/app/api/interview/answers/generate/route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/interview/prompts.ts src/lib/interview/prompts.test.ts \
  src/app/api/interview/answers/generate
printf '%s\n' \
  'feat(interview): generate grounded answer drafts' \
  '' \
  '- Generate conversational answers from confirmed evidence only' \
  '- Add optional owned-application context for tailoring' \
  '- Return missing-evidence prompts without persisting drafts' > /tmp/cm.txt
git commit -F /tmp/cm.txt
rm /tmp/cm.txt
```

### Task 6: Add Evidence Discovery With Explicit Confirmation

**Files:**

- Create: `src/lib/interview/parse-generation.ts`
- Create: `src/lib/interview/parse-generation.test.ts`
- Create: `src/app/api/interview/discovery/draft/route.ts`
- Create: `src/app/api/interview/discovery/draft/route.test.ts`

- [ ] **Step 1: Write failing structured parsing tests**

```ts
expect(parseDiscoveryDraft(validJson)).toEqual({
  outcome: "story_found",
  story: expect.objectContaining({
    title: "Supported a teammate through a deadline",
    tags: ["teamwork"],
  }),
})

expect(() => parseDiscoveryDraft('{"outcome":"story_found"}')).toThrow(
  "AI returned an invalid discovery draft",
)
```

- [ ] **Step 2: Write failing route tests**

The request shape is:

```ts
{
  questionId: string
  responses: Array<{ prompt: string; answer: string }>
}
```

Assert:

- blank responses return 400;
- another user's question returns 404;
- a valid response returns one of `story_found`, `partial_evidence`, or `no_example`;
- `storyBank` and `interviewProfileFacts` are never written by this route.

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/interview/parse-generation.test.ts \
  src/app/api/interview/discovery/draft/route.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement the Zod parser and route**

Use this result union:

```ts
const discoveryDraftSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("story_found"),
    story: z.object({
      title: z.string().min(1),
      situation: z.string(),
      task: z.string(),
      action: z.string(),
      result: z.string(),
      tags: z.array(z.string()),
    }),
  }),
  z.object({
    outcome: z.literal("partial_evidence"),
    honestAnswer: z.string().min(1),
    limitations: z.string().min(1),
  }),
  z.object({
    outcome: z.literal("no_example"),
    honestAnswer: z.string().min(1),
    hypotheticalApproach: z.string().min(1),
  }),
])
```

The system prompt explicitly says that `story_found` is allowed only when the responses describe a real event. The route only returns the draft. Persistence happens later through `confirmDiscoveredStory()`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- src/lib/interview/parse-generation.test.ts \
  src/app/api/interview/discovery/draft/route.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/interview/parse-generation.ts \
  src/lib/interview/parse-generation.test.ts \
  src/app/api/interview/discovery/draft
printf '%s\n' \
  'feat(interview): draft evidence through guided discovery' \
  '' \
  '- Convert targeted responses into validated discovery outcomes' \
  '- Distinguish genuine, partial, and unavailable examples' \
  '- Keep discovered evidence unsaved until explicit confirmation' > /tmp/cm.txt
git commit -F /tmp/cm.txt
rm /tmp/cm.txt
```

### Task 7: Build Questions And Answer Composer UI

**Files:**

- Create: `src/app/(dashboard)/interview/interview-workspace.tsx`
- Create: `src/app/(dashboard)/interview/question-library.tsx`
- Create: `src/app/(dashboard)/interview/answer-composer.tsx`
- Create: `src/app/(dashboard)/interview/evidence-discovery.tsx`
- Create: `src/app/(dashboard)/interview/interview-workspace.test.tsx`
- Create: `src/app/(dashboard)/interview/answer-composer.test.tsx`
- Modify: `src/app/(dashboard)/interview/page.tsx`

- [ ] **Step 1: Write failing workspace tests**

Assert:

```ts
expect(screen.getByRole("tab", { name: "Questions" })).toHaveAttribute("data-active")
expect(screen.getByRole("tab", { name: "Practice" })).toBeVisible()
expect(screen.getByRole("tab", { name: "Story Bank" })).toBeVisible()
expect(screen.getByText("Tell me about yourself.")).toBeVisible()
```

For the composer:

- general generation calls `/api/interview/answers/generate` with `applicationId: null`;
- 409 opens discovery instead of showing an empty answer;
- selecting an application labels the draft as tailored;
- editing the textarea does not mutate the previously saved answer;
- save calls `saveAnswer` with the returned evidence snapshot.

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- 'src/app/(dashboard)/interview/interview-workspace.test.tsx' \
  'src/app/(dashboard)/interview/answer-composer.test.tsx'
```

Expected: FAIL.

- [ ] **Step 3: Convert `/interview/page.tsx` to the server shell**

Keep authentication and metadata. Replace direct `StoryBank` rendering with:

```tsx
const workspace = await loadInterviewWorkspace(user.id)

return (
  <InterviewWorkspace
    initial={workspace}
    createQuestionAction={createQuestion}
    saveAnswerAction={saveAnswer}
    confirmDiscoveredStoryAction={confirmDiscoveredStory}
  />
)
```

Do not mark the page as a Client Component.

- [ ] **Step 4: Implement the approved tab layout**

Use the existing `Tabs`, `Card`, `Badge`, `Button`, and `Input` components. The default Questions tab contains:

- About Me summary strip;
- category filters;
- add-question form;
- question cards with answer/evidence status;
- actions for Generate answer, Tailor to job, and Practise.

Persist the selected tab in `?tab=questions|practice|stories` with `router.replace(..., { scroll: false })`.

When a built-in catalogue question has no database ID, call `createQuestion` with `sourceType: "built_in"` and its stable catalogue key before requesting generation. Reuse the returned ID for later saves.

- [ ] **Step 5: Implement answer draft and discovery state**

`AnswerComposer` owns:

```ts
type ComposerState =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "editing"; content: string; evidence: EvidenceSnapshot; applicationId: string | null }
  | { kind: "discovering"; prompts: string[] }
  | { kind: "error"; message: string }
```

`EvidenceDiscovery` displays one prompt at a time, preserves prior answers, submits all responses only at the review step, and presents editable STAR fields before calling `confirmDiscoveredStory`.

After confirmation, re-run answer generation for the same question.

If `evidenceStale` is true, show “Source information changed” and offer Regenerate. Keep the saved answer readable.

- [ ] **Step 6: Preserve unsaved text on errors**

Never clear the answer textarea or discovery responses when a route/action fails. Display the error inline and keep Retry available.

- [ ] **Step 7: Run component tests**

Run:

```bash
npm test -- 'src/app/(dashboard)/interview/interview-workspace.test.tsx' \
  'src/app/(dashboard)/interview/answer-composer.test.tsx'
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add 'src/app/(dashboard)/interview/page.tsx' \
  'src/app/(dashboard)/interview/interview-workspace.tsx' \
  'src/app/(dashboard)/interview/question-library.tsx' \
  'src/app/(dashboard)/interview/answer-composer.tsx' \
  'src/app/(dashboard)/interview/evidence-discovery.tsx' \
  'src/app/(dashboard)/interview/interview-workspace.test.tsx' \
  'src/app/(dashboard)/interview/answer-composer.test.tsx'
printf '%s\n' \
  'feat(interview): add personal question and answer workspace' \
  '' \
  '- Add Questions, Practice, and Story Bank navigation' \
  '- Generate, edit, and save general or tailored answer drafts' \
  '- Guide missing evidence through confirmation-based discovery' > /tmp/cm.txt
git commit -F /tmp/cm.txt
rm /tmp/cm.txt
```

### Task 8: Add About Me Review And Personalize Story Bank

**Files:**

- Create: `src/app/(dashboard)/interview/about-me-editor.tsx`
- Create: `src/app/(dashboard)/interview/about-me-editor.test.tsx`
- Modify: `src/app/(dashboard)/interview/story-bank.tsx`
- Create: `src/app/(dashboard)/interview/story-bank.test.tsx`
- Modify: `src/app/(dashboard)/interview/actions.ts`

- [ ] **Step 1: Write failing About Me tests**

Assert:

- CV drafts are labelled “Review before saving”;
- selecting two drafts confirms only those two;
- manual facts are confirmed immediately;
- deleting a fact asks for confirmation;
- no fact is generated or saved on initial render.

- [ ] **Step 2: Write failing Story Bank tests**

Assert:

- the generic “Load examples” button is absent;
- unconfirmed existing/imported rows show “Review needed”;
- confirmed stories show linked answer count;
- editing and confirming a draft updates it instead of creating a duplicate.

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm test -- 'src/app/(dashboard)/interview/about-me-editor.test.tsx' \
  'src/app/(dashboard)/interview/story-bank.test.tsx'
```

Expected: FAIL.

- [ ] **Step 4: Implement About Me review**

Render facts grouped by:

- Education
- Experience
- Projects
- Achievements
- Strengths and goals
- Personal context

CV drafts stay client-side until selected and confirmed. Add manual fact creation with category, label, and detail. Keep the editor secondary: open it from the summary strip rather than making it the default page.

- [ ] **Step 5: Update Story Bank behavior**

Remove the `importSampleStories` control. Add:

- source badge;
- confirmation badge;
- “Confirm story” action for drafts;
- linked saved-answer count;
- warning that unconfirmed stories are not used by AI.

Do not remove the existing STAR edit form.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- 'src/app/(dashboard)/interview/about-me-editor.test.tsx' \
  'src/app/(dashboard)/interview/story-bank.test.tsx'
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add 'src/app/(dashboard)/interview/about-me-editor.tsx' \
  'src/app/(dashboard)/interview/about-me-editor.test.tsx' \
  'src/app/(dashboard)/interview/story-bank.tsx' \
  'src/app/(dashboard)/interview/story-bank.test.tsx' \
  'src/app/(dashboard)/interview/actions.ts'
printf '%s\n' \
  'feat(interview): add confirmed About Me and story review' \
  '' \
  '- Let users review CV-derived facts before saving' \
  '- Remove generic stories from the personal evidence path' \
  '- Show confirmation and answer usage in Story Bank' > /tmp/cm.txt
git commit -F /tmp/cm.txt
rm /tmp/cm.txt
```

### Task 9: Add Typed Practice With Optional Job Context

**Files:**

- Create: `src/app/api/interview/practice/evaluate/route.ts`
- Create: `src/app/api/interview/practice/evaluate/route.test.ts`
- Create: `src/app/(dashboard)/interview/practice-session.tsx`
- Create: `src/app/(dashboard)/interview/practice-session.test.tsx`
- Modify: `src/app/(dashboard)/interview/interview-workspace.tsx`

- [ ] **Step 1: Write failing route tests**

Cover:

- question and answer are required;
- answer is capped at 5,000 characters;
- optional application must belong to the user;
- general practice excludes job context;
- tailored practice includes role and company;
- feedback uses the exact sections `What worked`, `What was missing`, `Structure check`, and `Stronger opening`.

- [ ] **Step 2: Write failing component tests**

Assert:

- question navigation resets typed answer and prior feedback only after explicit Next;
- word count updates;
- Submit is disabled for blank answers;
- route failure preserves typed content;
- feedback never overwrites a saved answer;
- general/application filter changes the available question set.

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npm test -- src/app/api/interview/practice/evaluate/route.test.ts \
  'src/app/(dashboard)/interview/practice-session.test.tsx'
```

Expected: FAIL.

- [ ] **Step 4: Implement the route**

Factor the useful structure from the existing application evaluation route, but accept nullable `applicationId`. Authenticate and rate-limit before resolving AI configuration.

Return:

```ts
return NextResponse.json({ feedback })
```

Do not write to `interview_answers`.

- [ ] **Step 5: Implement `PracticeSession`**

Use saved or catalogue questions, optional application filtering, previous/next controls, textarea, word count, evaluate button, inline error, feedback card, and Try again.

Aim copy at spoken delivery:

```text
Type the answer you would say aloud. Keep it specific and natural.
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/app/api/interview/practice/evaluate/route.test.ts \
  'src/app/(dashboard)/interview/practice-session.test.tsx'
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/interview/practice/evaluate \
  'src/app/(dashboard)/interview/practice-session.tsx' \
  'src/app/(dashboard)/interview/practice-session.test.tsx' \
  'src/app/(dashboard)/interview/interview-workspace.tsx'
printf '%s\n' \
  'feat(interview): add typed answer practice' \
  '' \
  '- Evaluate general or job-specific practice responses' \
  '- Preserve typed content across failures' \
  '- Keep coaching feedback separate from saved answers' > /tmp/cm.txt
git commit -F /tmp/cm.txt
rm /tmp/cm.txt
```

### Task 10: Bridge Existing Application Questions Into The Library

**Files:**

- Modify: `src/app/(dashboard)/interview/actions.ts`
- Modify: `src/app/(dashboard)/applications/[id]/interview/page.tsx`
- Modify: `src/app/(dashboard)/applications/[id]/interview/page.test.tsx`
- Modify: `src/app/(dashboard)/interview/question-library.tsx`

- [ ] **Step 1: Write failing import tests**

Test `saveApplicationQuestions(applicationId, questions)`:

- rejects another user's application;
- strips existing `**Q1.**` prefixes;
- inserts each question with `sourceType: "application_generated"`;
- uses `sourceRef: "${applicationId}:${normalizedQuestion}"`;
- skips duplicates;
- returns `{ imported, skipped }`.

- [ ] **Step 2: Write failing page tests**

On the application interview prep page:

```ts
expect(screen.getByRole("button", { name: "Save questions to library" })).toBeVisible()
```

After success, show:

```text
10 questions saved to your Interview Prep library.
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm test -- 'src/app/(dashboard)/interview/actions.test.ts' \
  'src/app/(dashboard)/applications/[id]/interview/page.test.tsx'
```

Expected: FAIL.

- [ ] **Step 4: Implement the bridge**

Add the button only when generated questions exist. Keep existing Prep, Research, and Grill Me tabs unchanged.

In the sidebar library, show application-generated questions with the company/role label and allow immediate tailoring or practice.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- 'src/app/(dashboard)/interview/actions.test.ts' \
  'src/app/(dashboard)/applications/[id]/interview/page.test.tsx'
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/(dashboard)/interview/actions.ts' \
  'src/app/(dashboard)/interview/question-library.tsx' \
  'src/app/(dashboard)/applications/[id]/interview/page.tsx' \
  'src/app/(dashboard)/applications/[id]/interview/page.test.tsx'
printf '%s\n' \
  'feat(interview): import application questions into library' \
  '' \
  '- Save generated application questions with stable deduplication' \
  '- Preserve the existing application prep and Grill Me flow' \
  '- Label imported questions with their role context' > /tmp/cm.txt
git commit -F /tmp/cm.txt
rm /tmp/cm.txt
```

### Task 11: Verify The Complete Workflow

**Files:**

- Create: `tests/e2e/interview-prep.spec.ts`
- Create: `src/app/interview-test-harness/page.tsx`
- Create: `src/app/interview-test-harness/interview-test-harness-client.tsx`
- Modify: `playwright.config.ts`
- Modify only if verification exposes a defect: files owned by Tasks 1-10

- [ ] **Step 1: Add a runtime-gated test harness**

`src/app/interview-test-harness/page.tsx` must return `notFound()` unless:

```ts
import { connection } from "next/server"
import { notFound } from "next/navigation"

export default async function InterviewTestHarnessPage() {
  await connection()

  if (process.env.PLAYWRIGHT_INTERVIEW_FIXTURE !== "1") {
    notFound()
  }

  return <InterviewTestHarnessClient />
}
```

This follows the Next.js 16 runtime environment guidance: call `connection()` before reading the server-only environment variable.

The guard condition is:

```ts
process.env.PLAYWRIGHT_INTERVIEW_FIXTURE === "1"
```

The client harness renders `InterviewWorkspace` with fixture data and local async mutation adapters. Production `/interview` continues to receive real Server Actions. Update Playwright's web server:

```ts
webServer: {
  command: "npm run start -- --hostname 127.0.0.1 --port 3000",
  env: { PLAYWRIGHT_INTERVIEW_FIXTURE: "1" },
  reuseExistingServer: !process.env.CI,
  url: "http://127.0.0.1:3000",
},
```

Mock only the three AI route requests with `page.route`; persistence-like UI state stays in the harness adapter.

- [ ] **Step 2: Add the end-to-end scenario**

Cover:

```ts
test("creates, discovers, tailors, and practises an interview answer", async ({ page }) => {
  let generationCalls = 0
  await page.route("**/api/interview/answers/generate", async (route) => {
    generationCalls += 1
    if (generationCalls === 2) {
      await route.fulfill({
        status: 409,
        json: {
          status: "needs_evidence",
          prompts: [
            "Think about university, projects, or helping someone. What happened?",
            "What did you personally do beyond what was expected?",
          ],
        },
      })
      return
    }
    await route.fulfill({
      status: 200,
      json: {
        content: "I adapted quickly, took ownership, and delivered a clear result.",
        evidenceSnapshot: {
          factIds: ["fact-1"],
          storyIds: generationCalls > 2 ? ["story-discovered"] : ["story-1"],
          generatedAt: "2026-06-15T12:00:00.000Z",
        },
      },
    })
  })
  await page.route("**/api/interview/discovery/draft", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        outcome: "story_found",
        story: {
          title: "Created peer study support",
          situation: "My cohort needed clearer study support.",
          task: "I wanted to make useful resources easier to access.",
          action: "I organised shared materials and weekly study sessions.",
          result: "Classmates used the sessions through dissertation season.",
          tags: ["initiative", "teamwork"],
        },
      },
    })
  })
  await page.route("**/api/interview/practice/evaluate", async (route) => {
    await route.fulfill({
      status: 200,
      json: {
        feedback: "## What worked\n- Specific ownership\n\n## What was missing\n- A measurable result\n\n## Structure check\nClear STAR flow.\n\n## Stronger opening\nI noticed my cohort needed better support.",
      },
    })
  })
  await page.goto("/interview-test-harness")
  await page.getByRole("button", { name: "Generate answer" }).first().click()
  await expect(page.getByLabel("Answer draft")).toBeVisible()
  await page.getByRole("button", { name: "Save answer" }).click()

  await page.getByText("Tell me about a time you went the extra mile.").click()
  await page.getByRole("button", { name: "Generate answer" }).click()
  await page.getByRole("button", { name: "Find an example" }).click()
  await page.getByLabel("Your response").fill("I organised extra study support for my cohort.")
  await page.getByRole("button", { name: "Next" }).click()
  await page.getByLabel("Your response").fill("I created shared resources and ran weekly sessions.")
  await page.getByRole("button", { name: "Review story" }).click()
  await expect(page.getByDisplayValue("Created peer study support")).toBeVisible()
  await page.getByRole("button", { name: "Confirm and use story" }).click()
  await expect(page.getByLabel("Answer draft")).toBeVisible()

  await page.getByRole("button", { name: "Tailor to job" }).click()
  await page.getByLabel("Application").selectOption({ label: /Engineer/ })
  await expect(page.getByText(/Tailored for/)).toBeVisible()

  await page.getByRole("tab", { name: "Practice" }).click()
  await page.getByLabel("Your answer").fill("My spoken practice answer")
  await page.getByRole("button", { name: "Evaluate my answer" }).click()
  await expect(page.getByRole("heading", { name: "What worked" })).toBeVisible()
})
```

Never call paid AI providers in CI.

- [ ] **Step 3: Run focused unit and component tests**

Run:

```bash
npm test -- src/lib/interview \
  'src/app/(dashboard)/interview' \
  src/app/api/interview
```

Expected: PASS.

- [ ] **Step 4: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS with no regressions in existing application interview prep.

- [ ] **Step 5: Run lint and production build**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands exit `0`.

- [ ] **Step 6: Run the focused E2E test**

Run:

```bash
npx playwright test tests/e2e/interview-prep.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Verify visually in the in-app browser**

Start the app:

```bash
npm run dev
```

Use the Browser plugin to inspect:

- `/interview?tab=questions` on desktop and mobile widths;
- answer generation and unsaved edit behavior;
- About Me review;
- Story Bank confirmation;
- discovery review before save;
- general versus tailored labels;
- `/interview?tab=practice`;
- existing `/applications/<owned-id>/interview` Prep, Research, and Grill Me tabs.

Expected: no overflow, stale loading state, inaccessible controls, or accidental data loss.

- [ ] **Step 8: Commit verification coverage**

```bash
git add tests/e2e/interview-prep.spec.ts \
  src/app/interview-test-harness/page.tsx \
  src/app/interview-test-harness/interview-test-harness-client.tsx \
  playwright.config.ts
printf '%s\n' \
  'test(interview): cover personal prep workflow' \
  '' \
  '- Verify answer generation, evidence confirmation, and tailoring' \
  '- Verify typed practice feedback' \
  '- Protect the existing application interview workflow' > /tmp/cm.txt
git commit -F /tmp/cm.txt
rm /tmp/cm.txt
```

## Final Acceptance Checklist

- [ ] Questions are common, custom, or imported from an owned application.
- [ ] General answers use confirmed evidence and no job context.
- [ ] Tailored answers use the selected owned application and never overwrite general answers.
- [ ] Missing evidence enters discovery rather than producing invented prose.
- [ ] Discovery saves nothing before explicit confirmation.
- [ ] CV-derived About Me facts remain drafts until selected and confirmed.
- [ ] Story Bank no longer treats generic examples as personal evidence.
- [ ] The six supplied answers can be imported only into the explicitly targeted account.
- [ ] Typed practice feedback never overwrites saved answers.
- [ ] Cross-user access is rejected for every resource type.
- [ ] Existing application Prep, Research, and Grill Me behavior still passes.
- [ ] Unit, component, route, E2E, lint, and build checks pass.
