# JobClock LinkedIn Launch Video Design

## Purpose

Create a 16:9 launch video for JobClock that can be posted on LinkedIn and other social networks, with LinkedIn as the primary audience. The video should show JobClock as a coherent, real application and help potential software engineering employers understand the product thinking behind it.

The LinkedIn caption will carry most of the personal builder context, so the video itself should stay focused on the user workflow.

## Audience

Primary audience: potential software engineering employers and technical peers on LinkedIn.

Secondary audience: job seekers who understand the friction of managing applications, tailoring documents, and keeping track of progress.

## Tone

The video should feel calm, capable, and deliberate. It should avoid hype, exaggerated AI language, and generic startup montage styling. The intended impression is that JobClock is a thoughtful product built around a painful workflow.

## Format

- Aspect ratio: 16:9 landscape.
- Length: approximately 45 to 55 seconds.
- Audio: silent-first. The video must work without voiceover.
- Text: use readable on-screen captions and short UI labels.
- Platform fit: optimized for a LinkedIn feed post, but reusable on other social networks.

## Creative Approach

Use app-faithful recreated UI scenes in Remotion rather than raw screen recordings.

The scenes should look like JobClock itself: sharp borders, monochrome base, restrained burgundy accent, dense dashboard panels, sidebar navigation, and existing product vocabulary. The UI should be polished and legible at 16:9 video size while still feeling like it belongs to the real application.

Avoid abstract generic SaaS cards. Avoid making the video primarily about the technical stack. Technical depth should be inferred from the completeness and credibility of the workflow.

## Story

Follow one fictional role through the product:

- Role: Software Engineer, Platform Tools.
- Company: Northstar Labs.

The story should show:

1. A user starts inside JobClock by uploading a base CV.
2. The user finds the role in a browser tab.
3. The JobClock browser extension extracts the role details and saves it to JobClock.
4. The saved role appears in the application workflow.
5. JobClock shows role and company research.
6. JobClock compares the role against the uploaded base CV.
7. JobClock creates a tailored CV with short progress states and small generated excerpts.
8. JobClock connects the role to the user's interview story bank.
9. JobClock generates role-specific interview preparation.
10. The Grill Me tab lets the user practice a question, request an AI STAR suggestion, and evaluate an answer.
11. The application moves through the pipeline.
12. The video ends with an understated product card.

## Scene Outline

### Scene 1: Base CV Setup

Show the JobClock workspace on the My CV area. The key message is that JobClock starts from a real base CV, not from generic AI output.

Caption: "Start with your base CV."

### Scene 2: Browser Extension Save

Show a job listing page for "Software Engineer, Platform Tools" at "Northstar Labs". The JobClock browser extension appears, displaying extracted role details: title, company, location, and source.

Primary action: "Save to JobClock".

Confirmation: "Saved to pipeline."

Caption: "Capture a role from the browser."

### Scene 3: Application Workspace

Show the saved role inside JobClock with the sidebar and application-focused layout. The role should feel connected to the same item captured by the extension.

Caption: "Bring the opportunity into one workspace."

### Scene 4: Research

Show role and company research panels with concise, readable findings. Keep text short and specific.

Example findings:

- "Platform tooling team"
- "Internal developer workflows"
- "Strong fit for automation experience"

Caption: "Research the company and role."

### Scene 5: CV Tailoring

Show progress states:

- "Analyzing role requirements"
- "Comparing against base CV"
- "Drafting tailored bullets"

Include one small generated excerpt to make the result concrete.

Example excerpt: "Improved internal reporting workflows and reduced manual handoff time."

Caption: "Tailor the CV from your source material."

### Scene 6: Interview Story Bank

Show the global `/interview` page as the user's STAR story bank. Include the page title "Story bank.", a short list of saved stories, competency tags, and one expanded STAR card with Situation, Task, Action, and Result sections.

Caption: "Keep interview stories ready."

### Scene 7: Role-Specific Interview Prep

Show the per-application interview workspace with the tabs visible: "Interview Prep", "Company Research", and "Grill Me".

Start on the Interview Prep tab. Show the "Generate Interview Prep" action, then the generated result with likely questions, best story matches, and a technical prep checklist. The copy should make it clear that prep uses the job description and the story bank.

Caption: "Generate prep from the role and your stories."

### Scene 8: Grill Me Practice

Switch to the Grill Me tab. Show a question navigator, one role-specific question, the "Get AI STAR suggestion" action, a short suggested STAR answer preview, the user's answer text area, and the "Evaluate my answer" action.

Keep this beat concise. The goal is to show the practice loop, not a full answer evaluation.

Caption: "Practice before the interview."

### Scene 9: Pipeline

Show the application moving from "Saved" to "Applied" in the pipeline with visible statuses.

Caption: "Track every application deliberately."

### Scene 10: End Card

Show the JobClock brand and an understated statement:

JobClock

A full workflow for serious job applications.

Built by Michael Ogunjimi

## Visual Requirements

- Match the existing JobClock interface direction.
- Use dark sidebar navigation, light workspace panels, sharp borders, and restrained accent color.
- Keep all text readable in a LinkedIn feed.
- Use motion to guide focus rather than decorate.
- Prefer direct product interactions: upload, save, analyze, generate, track.
- Avoid showing the in-app job search as the primary flow because it is not currently the strongest workflow.
- Include both interview surfaces accurately: the global `/interview` story bank and the per-application Grill Me tab.

## Implementation Notes

- Build the video as a Remotion composition inside the existing repository under a clearly named `video/` folder.
- Use recreated UI components that are faithful to JobClock rather than screenshots when it improves legibility and timing.
- Keep the composition data-driven enough that captions, role details, and timing can be adjusted without rewriting scene markup.
- Validate with at least one still render and one full video render.

## Success Criteria

- A viewer can understand the full user workflow without sound.
- The video looks like JobClock, not a generic product animation.
- The fictional role remains consistent across scenes.
- The browser extension is a clear early highlight.
- The base CV setup is visible before the AI tailoring beat.
- The interview section shows the Story Bank, Interview Prep tab, and Grill Me practice loop as distinct parts of the workflow.
- The final video feels appropriate for a professional LinkedIn post aimed at software engineering employers.
