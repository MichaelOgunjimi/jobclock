# Interview Prep Consolidation Design

**Date:** 2026-06-19  
**Status:** Approved design  
**Scope:** Consolidate the global Interview Prep workspace and per-application interview tools

## Goal

Make `/interview` the single place where the user prepares and practises for interviews, while keeping Company Research and other application documents on the application page.

The consolidation must:

- remove the current duplication between `/interview` and `/applications/[id]/interview`;
- let the user switch between general preparation and a selected application;
- bring job-specific questions and Grill Me into the central workspace;
- reuse saved Company Research without duplicating its management interface;
- preserve existing interview prep, research, suggested answers, and tailored CV data; and
- keep all generated answers grounded in confirmed personal evidence.

## Product Decision

### Canonical Interview Workspace

`/interview` is the canonical interview-preparation destination.

It owns:

- the common and job-specific question library;
- general and application-specific answer versions;
- typed Grill Me practice and AI evaluation;
- Story Bank;
- About Me facts;
- tailored-CV fact confirmation; and
- evidence discovery when a genuine example is missing.

### Application Workspace

`/applications/[id]` remains the canonical location for:

- job details and description;
- Company Research;
- tailored CV generation and editing;
- cover letters; and
- application status and notes.

Company Research is created, refreshed, displayed, and managed from the application context. Interview Prep only reads its saved result.

## Considered Approaches

### 1. Keep Both Interview Systems

Continue using `/interview` for general preparation and `/applications/[id]/interview` for job-specific prep, research, and Grill Me.

This has the lowest immediate implementation cost but creates two question stores, two answer-generation paths, and two practice experiences. The systems will continue to disagree about stories, answers, and job context.

**Decision:** Rejected.

### 2. Move Everything Into Interview Prep

Move Questions, Grill Me, and Company Research into `/interview`.

This produces one visible destination but duplicates the application page's research context and places job intelligence beside personal evidence management. It also makes Company Research harder to find when working on CVs and cover letters.

**Decision:** Rejected.

### 3. Central Interview Hub With Application-Owned Research

Move Questions and Grill Me into `/interview`. Keep Company Research on the application page and consume its saved output inside interview generation and evaluation.

This produces one interview system without duplicating research controls or records.

**Decision:** Approved.

## Navigation

### Sidebar

The sidebar's **Interview Prep** link continues to open:

```text
/interview
```

This defaults to general preparation.

### Application Page

The application page's **Interview Prep** action opens:

```text
/interview?applicationId=<owned-application-id>
```

The central workspace starts with that application selected.

### Legacy Route

`/applications/[id]/interview` becomes a compatibility redirect to:

```text
/interview?applicationId=<id>
```

The redirect verifies that the application belongs to the authenticated user. Existing bookmarks remain useful, while the duplicate client page is retired.

## Workspace Structure

The central workspace has four primary sections:

### Questions

Questions shows:

- built-in common interview questions;
- user-created questions;
- questions imported from existing application interview prep;
- future questions generated from the selected job description and saved Company Research; and
- indicators for general and selected-application saved answers.

When no application is selected, Questions shows general preparation only.

When an application is selected, Questions shows both:

- reusable common questions; and
- questions associated with that application.

Answer generation uses the selected context but never replaces the general answer.

### Grill Me

Grill Me replaces the current basic Practice tab.

It draws questions from the same central question library rather than parsing a separate markdown interview plan at practice time.

The user can choose:

- general questions;
- questions for the selected application; or
- a mixed practice session.

For each question, Grill Me provides:

- the question;
- a typed response area;
- word count;
- comparison with the saved general or tailored answer;
- AI evaluation;
- retry and next-question controls; and
- clear feedback on relevance, specificity, evidence, structure, and delivery.

Evaluation receives selected application context when present:

- job title, company, and description;
- saved Company Research;
- saved tailored answer;
- confirmed facts and stories referenced by that answer; and
- the user's practice response.

Evaluation must not create a new personal claim or silently update a saved answer.

### Story Bank

Story Bank remains the confirmed source for competency examples.

It continues to support:

- manual stories;
- discovery-created stories;
- confirmation status;
- STAR fields;
- competency tags; and
- answer usage counts.

### About Me

About Me remains the source for confirmed profile facts.

It includes:

- manually entered facts;
- primary-CV suggestions;
- selected application's tailored-CV suggestions; and
- editing and deletion of confirmed facts.

## Application Selection

A searchable application picker is shared across Questions and Grill Me.

The selected application is initialized from `applicationId` in the URL. Changing the selection updates the URL without a full navigation.

The available contexts are:

- **General preparation**, represented by no application ID; and
- an owned application.

If the URL contains a missing or foreign application ID:

- the workspace falls back to General preparation;
- no foreign job data is returned; and
- a non-blocking message explains that the application could not be loaded.

## Company Research

### Ownership

Company Research remains stored in `interview_prep.research_content` and managed through the existing application research flow.

Interview Prep does not add a separate Company Research tab or duplicate research records.

### Interview Prep Usage

When an application is selected, the workspace loads:

- whether saved research exists;
- the saved research content for server-side generation and evaluation; and
- a short status for the client interface.

The visible Interview Prep interface shows one compact status:

- **Research available**, with a link to view or refresh it on the application page; or
- **No company research yet**, with a link to create it on the application page.

The full research document is not rendered inside Interview Prep.

### Generation Rules

Saved Company Research may influence:

- job-specific question generation;
- emphasis in tailored answers;
- likely interviewer priorities;
- suggested questions for the candidate to ask; and
- Grill Me evaluation.

It may not be treated as evidence about the user. Personal claims still require confirmed About Me facts or Story Bank stories.

If research is missing, Questions, answers, and Grill Me still work using the job description. Missing research must not block preparation.

## Existing Interview Prep Migration

The existing `interview_prep` record remains the storage location for:

- generated markdown interview guidance;
- saved Company Research; and
- legacy suggested answers during the transition.

### Existing Questions

Questions parsed from existing generated prep are imported into `interview_questions` as:

- `source_type = application_generated`;
- `application_id = selected application`;
- a stable application-scoped `source_ref`; and
- the closest supported question category.

Import is idempotent.

### Existing Suggested Answers

Legacy suggested answers remain readable during transition.

When a legacy answer is opened or saved in the central workspace:

- it is copied into `interview_answers`;
- it is associated with the matching central question and application;
- it remains editable; and
- it does not become confirmed evidence.

New answer generation uses the grounded central answer route only. The legacy `interview_answer` generation path is retired after migration compatibility is verified.

## Data Flow

### Loading The Workspace

The `/interview` server page loads in parallel:

- common and saved questions;
- saved general and tailored answers;
- confirmed facts and stories;
- owned applications;
- latest tailored-CV fact suggestions;
- selected application's generated interview prep;
- selected application's saved Company Research status; and
- application-generated questions not yet materialized in the central store.

Only the selected application's larger research and prep content is loaded.

### Generating A Tailored Answer

1. Authenticate the user.
2. Verify ownership of the question and selected application.
3. Select confirmed user facts and stories.
4. Load the job description.
5. Load saved Company Research when available.
6. Load the selected application's confirmed tailored-CV facts.
7. Assess evidence sufficiency.
8. Generate a draft without saving it.
9. Let the user edit and explicitly save the tailored answer.

### Evaluating A Practice Answer

1. Authenticate and verify the selected context.
2. Load the central question.
3. Load the user's typed answer.
4. Load the saved answer for comparison when one exists.
5. Load job description and saved Company Research when an application is selected.
6. Return coaching feedback without modifying saved content.

## API And Component Boundaries

### Reused Server Data

The central interview read model gains selected-application context:

- saved research availability;
- legacy generated prep questions;
- tailored-CV suggestions; and
- saved tailored answers.

### New Or Consolidated Operations

- Materialize legacy application questions into `interview_questions`.
- Evaluate practice answers through one central interview evaluation route.
- Read saved Company Research for prompt context.
- Redirect the legacy per-application interview route.

### Client Components

The central workspace contains:

- `ApplicationContextPicker`
- `QuestionLibrary`
- `AnswerComposer`
- `GrillMeSession`
- `StoryBank`
- `AboutMeEditor`
- `ApplicationResearchStatus`

The current `PracticeSession` is replaced by `GrillMeSession`.

## Background Jobs And Persistence

Company Research and full application interview-plan generation may continue to use the existing generation job infrastructure and QStash dispatch.

Interactive operations remain request-response:

- grounded answer draft generation;
- evidence discovery;
- Grill Me evaluation; and
- saving confirmed facts, stories, and answers.

Interactive answer drafts remain unsaved until the user selects **Save answer**.

## Security

Every selected application is verified against the authenticated user before:

- loading job details;
- loading Company Research;
- loading tailored CVs;
- loading legacy interview prep;
- generating questions or answers; or
- evaluating practice.

The client never supplies a trusted user ID.

Company Research is treated as external company context, not personal evidence.

## Error Handling

- Failure to load Company Research does not block Interview Prep.
- Failed question import leaves the legacy prep record unchanged.
- Failed answer generation preserves the current textarea.
- Failed Grill Me evaluation preserves the user's typed response.
- Unknown application URL parameters fall back to General preparation.
- Redirecting from a foreign legacy application route returns the existing protected not-found behavior.

## Testing

### Unit And Integration

Test:

- selected application ownership;
- URL initialization and invalid application fallback;
- idempotent import of legacy questions;
- saved Company Research included in tailored prompt context;
- Company Research excluded from personal evidence;
- Grill Me question filtering;
- saved general versus tailored answer comparison;
- evaluation failure preserving typed input; and
- compatibility redirect from the legacy route.

### Browser Workflow

Cover:

1. Open an application and choose Interview Prep.
2. Confirm the central workspace opens with that application selected.
3. See research status and follow the application-page research link.
4. Import or display job-specific questions.
5. Generate and save a tailored answer.
6. Open Grill Me and practise that question.
7. Receive evaluation using the selected job context.
8. Switch to General preparation and confirm application-specific content disappears.

## Rollout

1. Add selected-application context and research status to the central workspace.
2. Import legacy application questions into the central question model.
3. Replace Practice with central Grill Me evaluation.
4. Change application-page Interview Prep links to the central URL.
5. Convert the legacy application interview page to a protected redirect.
6. Retain legacy data reads for one transition period.
7. Remove obsolete legacy answer-generation code only after compatibility tests pass.

## Out Of Scope

- Moving Company Research into the central Interview Prep interface.
- Automatically refreshing Company Research when Interview Prep opens.
- Voice recording or transcription.
- Live interviewer avatars.
- Persisting every practice attempt.
- Replacing the existing application research generation pipeline.

## Success Criteria

The consolidation is successful when:

- users encounter one Interview Prep workspace rather than two;
- application links open that workspace with the correct job selected;
- Questions and Grill Me use the same question and answer records;
- Company Research remains application-owned but improves tailored preparation;
- general preparation remains available without selecting a job;
- no existing saved research or generated prep is lost; and
- answer generation continues to use confirmed personal evidence only.
