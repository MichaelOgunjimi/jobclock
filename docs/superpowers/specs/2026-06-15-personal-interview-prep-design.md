# Personal Interview Prep Design

**Date:** 2026-06-15  
**Status:** Approved design  
**Scope:** Interview Prep workspace MVP

## Goal

Turn the sidebar's Interview Prep area into a personal interview coach that:

- learns reusable facts and experiences about the user;
- generates complete, natural answers grounded in confirmed evidence;
- helps uncover a genuine example when evidence is missing;
- creates separate job-tailored versions without changing the underlying facts; and
- supports typed practice with actionable feedback.

The experience should feel like the six supplied example answers: conversational, specific, and ready to say aloud. STAR remains an internal quality framework rather than visible headings in the final answer.

## Product Principles

1. **Learn once, reuse often.** The user should not repeat their background for every question.
2. **Evidence before prose.** AI can restructure and emphasize confirmed facts, but must not invent events, responsibilities, tools, dates, metrics, or outcomes.
3. **Confirmation before memory.** Information discovered through prompts is temporary until the user reviews and confirms it.
4. **General answers remain stable.** Tailoring to a job creates a separate answer version and never overwrites the general answer.
5. **Keep the machinery quiet.** Questions and practice are primary. About Me and Story Bank support them without forcing the user to manage a complex knowledge system.

## Approved Navigation

The existing `/interview` sidebar destination remains a single workspace with three sections:

### Questions

The default section. It contains:

- common questions such as "Tell me about yourself";
- competency questions grouped by themes such as resilience, teamwork, leadership, initiative, pressure, and mistakes;
- questions manually added by the user; and
- job-specific questions imported or generated from a selected application.

Each question shows whether:

- a general personal answer exists;
- enough confirmed evidence exists to create one;
- a tailored answer exists for a selected application; or
- JobClock needs more information.

Primary actions are **Add question**, **Generate answer**, **Tailor to job**, and **Practise**.

### Practice

The user chooses saved questions and works through them one at a time.

For the MVP:

- answers are typed;
- the current word count is visible;
- feedback covers relevance, specificity, structure, evidence, and delivery;
- feedback may show a stronger opening, but does not silently replace the saved answer; and
- voice recording, transcription, timers, and live mock interviews are out of scope.

Practice can use general questions or questions filtered to one application.

### Story Bank

The existing Story Bank remains, but its purpose is clarified: it stores the user's confirmed experiences that can support many answers.

It must:

- contain personal, editable experiences;
- preserve the existing Situation, Task, Action, Result, and competency tags;
- show which saved answers use each story;
- stop presenting generic sample stories as though they describe the user; and
- allow the six supplied answers to be converted into initial personal stories and answers.

Generic examples may be displayed as prompts or templates, but are never saved as personal evidence without review and confirmation.

## About Me

About Me is a secondary review area linked from the Interview Prep workspace, not a mandatory first screen.

It contains concise, editable facts grouped into:

- education and qualifications;
- work and volunteering;
- projects and technical experience;
- achievements;
- career goals and strengths; and
- relevant personal context, such as relocation or adapting to a new environment.

An initial profile is extracted from the user's primary CV and existing Story Bank. Extracted facts are presented for review before becoming confirmed interview evidence.

The user can add, edit, confirm, or delete facts at any time. Deleting a fact prevents future generations from using it but does not silently rewrite previously saved answers.

## Core Answer Flow

1. The user chooses a question or adds one.
2. JobClock searches confirmed About Me facts and Story Bank experiences owned by that user.
3. JobClock assesses whether the evidence is sufficient for an honest answer.
4. If sufficient, JobClock generates a complete conversational answer.
5. The user reviews and edits the answer before or after saving it.
6. If insufficient, JobClock starts a short evidence-discovery flow.
7. A selected application can then produce a separate tailored version.
8. Either version can be opened in Practice.

### Evidence-Discovery Flow

The flow asks one targeted question at a time, based on what is missing. Prompts should help the user search ordinary experiences, including university work, personal projects, relocation, deadlines, helping classmates, job searching, volunteering, and self-directed learning.

The flow must not pressure the user to manufacture a perfect example. It ends in one of three outcomes:

1. **A genuine story is found.** JobClock drafts a structured story for review.
2. **Only partial evidence is found.** JobClock proposes an honest, narrower answer and identifies its limitations.
3. **No genuine example exists.** JobClock helps the user prepare an honest response or a clearly labelled hypothetical approach.

Only the first outcome can be saved to Story Bank, and only after explicit confirmation. The user can edit every field before confirming.

## Answer Generation

### General Answer

A general answer is grounded in confirmed personal evidence and does not depend on a particular application.

The generated answer should:

- use first person;
- sound natural when spoken;
- normally fit within roughly two minutes;
- follow STAR internally where the question calls for an example;
- foreground the user's own actions and decisions;
- include outcomes only when supported by evidence; and
- avoid visible STAR labels unless the user explicitly requests them.

### Job-Tailored Answer

The user selects one of their applications. JobClock combines:

- the saved general question;
- the general answer and its evidence references;
- the job title, company, and job description; and
- existing application-specific interview prep, where available.

Tailoring may change emphasis, ordering, vocabulary, and the connection to role requirements. It may not add unsupported claims. The tailored version is saved separately and labelled with the application.

Regenerating a tailored answer creates an editable replacement only after the user chooses to save it. It never overwrites the general answer.

## Initial Content

The six supplied answers should seed the user's workspace:

1. Challenge overcome
2. Conflict with someone
3. Leadership or initiative
4. Mistake and learning
5. Working under pressure
6. Achievement or win

Import should prepare:

- six draft Story Bank entries containing the underlying evidence; and
- six draft general answers linked to matching common questions.

The user gets a one-time review step to correct the drafts and confirm them individually or together. Only confirmed stories become generation evidence. The import is idempotent, so re-running it must not create duplicates.

## Data Model

The existing `story_bank` table remains the source of confirmed experiences.

### `interview_profile_facts`

- `id`
- `user_id`
- `category`
- `label`
- `detail`
- `source_type` (`cv`, `manual`, `discovery`)
- `source_ref`
- `confirmed_at`
- `created_at`
- `updated_at`

Only rows with `confirmed_at` are available to answer generation.

### `interview_questions`

- `id`
- `user_id`
- `application_id` nullable
- `text`
- `category`
- `source_type` (`built_in`, `custom`, `application_generated`)
- `source_ref`
- `created_at`
- `updated_at`

Built-in questions can be materialized per user when saved or answered. This avoids duplicating the full catalogue for every account.

### `interview_answers`

- `id`
- `user_id`
- `question_id`
- `application_id` nullable
- `content`
- `evidence_snapshot` JSON
- `status` (`draft`, `saved`)
- `created_at`
- `updated_at`

A null `application_id` identifies the general answer. A non-null value identifies a tailored version. Two partial unique indexes enforce one saved answer per context:

- `(user_id, question_id)` where `application_id IS NULL` and `status = 'saved'`; and
- `(user_id, question_id, application_id)` where `application_id IS NOT NULL` and `status = 'saved'`.

`evidence_snapshot` records the fact and story identifiers used at generation time. It supports transparency and preserves why an older answer was generated even if source evidence is later edited or deleted.

### Existing `interview_prep`

The current application-specific `interview_prep` table continues to store generated process guidance, research, and raw job-specific questions.

Generated questions can be imported into `interview_questions` when the user saves, answers, or practises them. Existing application pages continue to work during the transition.

### Discovery Drafts

Unconfirmed discovery responses stay in client state for the MVP and are sent to the server only for generation. They are not persisted as profile facts or stories until the user confirms the final draft.

## Components And Boundaries

### Server Components

`/interview` authenticates the user and loads:

- question catalogue and saved question state;
- confirmed profile summary;
- saved answers;
- Story Bank entries; and
- applications available for tailoring.

### Client Workspaces

Focused client components own interactive state:

- `QuestionLibrary`
- `AnswerComposer`
- `EvidenceDiscovery`
- `PracticeSession`
- existing `StoryBank`, extended with answer references
- `AboutMeEditor`

Each component calls authenticated server actions. It does not receive or mutate another user's identifiers.

### Generation Services

Generation logic is separated into:

- evidence retrieval and sufficiency assessment;
- discovery prompt generation;
- story drafting from discovery responses;
- general answer generation;
- job-tailored answer generation; and
- practice evaluation.

All generation prompts receive structured, length-limited inputs. The answer generators use confirmed evidence only.

## Security And Ownership

Every read and mutation must:

- authenticate through Supabase;
- scope database queries by `user_id`;
- verify that any selected application belongs to the authenticated user; and
- verify ownership of referenced questions, stories, facts, and answers.

The server derives `user_id` from the authenticated session and never trusts a client-provided user identifier.

AI prompts include only the evidence needed for the current question. They do not receive the user's entire profile by default.

## Error Handling

- Failed generation leaves the current saved answer unchanged.
- Unsaved drafts remain visible when a request fails.
- Missing AI configuration produces a clear setup message.
- Rate limits produce a retry message without losing typed content.
- Deleted or inaccessible applications cannot be used for tailoring.
- Insufficient evidence routes to discovery instead of producing vague or fabricated prose.
- If evidence used by an answer has since changed, the saved answer remains readable and is marked as potentially outdated.

## Testing

### Unit Tests

- evidence retrieval excludes unconfirmed facts;
- sufficiency assessment selects relevant facts and stories;
- general prompts contain no job context;
- tailored prompts preserve evidence while including the selected job;
- import of the six supplied answers is idempotent;
- answer normalization preserves conversational formatting; and
- question catalogue categorization and deduplication.

### Server And Route Tests

- unauthenticated access is rejected;
- cross-user facts, stories, questions, answers, and applications are inaccessible;
- discovery content is not saved before confirmation;
- general and job-tailored versions do not overwrite each other;
- failed generation preserves existing saved content; and
- application-generated questions can be saved into the personal library.

### Component Tests

- Questions, Practice, and Story Bank navigation;
- answer edit and save;
- evidence-missing state enters discovery;
- confirmation review creates a Story Bank entry;
- application selector labels tailored versions;
- practice feedback does not overwrite saved answers; and
- empty, loading, error, and stale-evidence states.

### End-To-End Flow

1. Open Interview Prep.
2. Choose a common question.
3. Generate an answer from existing evidence.
4. Edit and save it.
5. Choose a question without evidence.
6. Complete targeted discovery prompts.
7. Review and confirm the discovered story.
8. Generate the personal answer.
9. Tailor it to an owned application.
10. Practise the tailored answer and receive feedback.

## MVP Boundaries

Included:

- editable About Me facts;
- personal Story Bank;
- common, custom, and application-generated questions;
- full conversational answers;
- confirmation-based evidence discovery;
- separate job-tailored answers; and
- typed practice with feedback.

Deferred:

- voice recording and transcription;
- audio delivery coaching;
- live conversational mock interviews;
- automatic background memory;
- spaced-repetition scheduling;
- scoring dashboards and practice analytics;
- sharing or coach collaboration; and
- automatic saving of inferred personal information.

## Success Criteria

The MVP succeeds when the user can open Interview Prep, choose or add a question, receive a factual full answer in their own voice, edit it, tailor it to a current job, and practise it without repeatedly explaining their background.

When JobClock lacks evidence, it should help the user discover a genuine example and require confirmation before remembering it.
