# Build Progress

## Phase E — AI Application Assist

### Done
- Application detail page: status stepper, description editor, notes, details card
- AI chat (`/api/chat/application`) with CV + job context
- Base CV selector + cover letter template selector
- `generateTailoredCv` server action: AI tailors CV → saves to `customized_cvs` with ATS score, skills gap, changes summary
- `generateCoverLetter` server action: AI writes cover letter → overwrites in `cover_letters` with application_id
- CvCard: generate button, ATS score badge, skills gap chips, changes summary, version history (last 3)
- CoverLetterCard: generate button, text preview, copy button, PDF download (html2pdf.js)
- CvData schema extended: `CvEducation` (location, gpa, honors, relevant_modules), `CvExperience` (location), `CvData` (linkedin, website, activities)
- AI prompt rewritten: XYZ formula, strong action verbs, JD keyword mirroring, highlights + technologies enforced for all entries
- 3 CV templates built: Classic (Harvard serif, all-caps header, section rules), Modern (Arial, centered bold name, bottom-border section heads), Sidebar (dark left rail with skills/contact, clean main column)
- Template switcher on CV preview page with preference saved to `profiles.preferences.preferred_cv_template`

- Settings > Documents: replaced DOCX upload with built-in template picker (CV + cover letter)
- Template preference saved to `profiles.preferences.preferred_cv_template` / `preferred_cover_letter_template`
- CV preview page: two-column layout (left: visual template picker + CV, right: ATS score / changes / skills gap panel)
- Template picker uses CSS wireframe thumbnails; switches template and saves preference
- Print isolation fixed: only the CV content renders on print (toolbar, picker, right panel all `print:hidden`)
- Description persistence fix: `router.refresh()` + error handling in `updateDescription` action

### Next
- Cover letter template rendering (Classic, Modern, Story-driven built-in layouts)
- CV editing on preview page (reuse editor components from profile/[cvId]/cv-editor.tsx)
- Application quality score display

## Phase F — Auto-Apply (PLANNED)
- AI picks best-fit CV from multiple CVs (needed here since user not present)
- Playwright form fill
- Human-in-the-loop review step
