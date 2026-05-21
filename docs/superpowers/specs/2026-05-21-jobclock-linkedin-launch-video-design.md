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
8. JobClock generates interview preparation material as the supporting next step.
9. The application moves through the pipeline.
10. The video ends with an understated product card.

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

### Scene 6: Supporting Materials

Show interview preparation as the supporting next step. Use a concise question bank and company-specific prep notes so the beat stays distinct from CV tailoring.

Caption: "Prepare the next application step."

### Scene 7: Pipeline

Show the application moving from "Saved" to "Applied" in the pipeline with visible statuses.

Caption: "Track every application deliberately."

### Scene 8: End Card

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
- The final video feels appropriate for a professional LinkedIn post aimed at software engineering employers.
