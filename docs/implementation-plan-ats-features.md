# Implementation Plan: Career-Ops + OpenPostings Adaptations

## Problem Statement
Job search returns stale results from aggregator APIs (Adzuna/Reed/Careerjet). No direct company board integration. Interview prep schema exists but no UI. No freshness indicators or smart dedup.

**Two reference projects analyzed**:
- **career-ops**: Quality-focused -- structured evaluation, CV tailoring, interview prep with STAR+R stories, follow-up cadence, 5 ATS APIs
- **OpenPostings**: Scale-focused -- 20+ ATS parsers, ~10,500 companies indexed, 24h TTL auto-expiry, URL-based ATS detection, ML industry classification

## Approach
Combine best of both into job-assistant Next.js/Supabase stack. Career-ops gives quality features (interview prep, follow-ups, analytics). OpenPostings gives scale (more ATS parsers, company catalog, auto-detection).

**Full analysis**: docs/careerops-adaptation-analysis.md + docs/openpostings-adaptation-analysis.md

---

## Todos

### Phase 1: Direct ATS Board Integration

#### 1. greenhouse-source
Create src/lib/jobs/greenhouse.ts. GET boards-api.greenhouse.io/v1/boards/SLUG/jobs. Handle EU boards. Return Job[]. No auth.

#### 2. lever-source
Create src/lib/jobs/lever.ts. GET api.lever.co/v0/postings/COMPANY. Map to Job interface. No auth.

#### 3. ashby-source
Create src/lib/jobs/ashby.ts. POST to jobs.ashbyhq.com/api/non-user-graphql with ApiJobBoardWithTeams. Map to Job[]. No auth.

#### 4. ats-url-detector
Create src/lib/jobs/ats-detector.ts. Detect ATS type from URL patterns. Extract company slug. (From OpenPostings)

#### 5. tracked-companies-schema
Migration: tracked_companies table (id, user_id, name, slug, ats_type, careers_url, enabled, created_at). UNIQUE(user_id, slug, ats_type). RLS policies. Drizzle schema.

#### 6. tracked-companies-settings
Settings UI: add company by URL (auto-detect ATS), list with enable/disable, delete. Show ATS type badge.

#### 7. integrate-ats-search
Update search route: fetch tracked companies, fire parallel ATS requests, merge with existing sources, dedup.

### Phase 2: Freshness and Search Improvements

#### 8. freshness-badges
Visual badges: Today (green), This week (blue), 2 weeks (yellow), 30+ days (red). Default sort by date.

#### 9. fuzzy-dedup
Create src/lib/jobs/dedup.ts. Normalize company, extract title keywords, flag dupes at 60pct+ overlap.

#### 10. title-filtering
Add title_include/exclude_keywords to preferences. Apply server-side in search.

#### 11. remote-detection
Parse title + location for remote/hybrid/WFH indicators. Add remote filter toggle.

### Phase 3: Interview Prep UI

#### 12. story-bank-ui
STAR+R stories: situation, task, action, result, reflection, tags. CRUD. Store in interview_prep table.

#### 13. interview-prep-page
Per-application: AI company research, common questions, story mapping. Uses existing schema.

### Phase 4: Follow-up and Analytics

#### 14. followup-reminders
next_followup_date on applications. Cadence rules by status. Dashboard overdue widget.

#### 15. application-analytics
Funnel (Saved to Applied to Interview to Offer), conversion rates, time-per-stage, role breakdown.

### Phase 5: Polish

#### 16. ats-pdf-normalization
Pre-render: em-dashes to hyphens, smart quotes to straight, zero-width chars removed.

---

## Dependencies
- 1, 2, 3 (ATS sources): independent, parallel
- 4 (ats-detector): independent
- 5 (schema): independent
- 6 (settings UI): depends on 4, 5
- 7 (search integration): depends on 1, 2, 3, 5
- 8-11 (search improvements): all independent
- 12 (story bank): independent
- 13 (interview page): depends on 12
- 14-16: all independent

## Notes
- ATS APIs are all public/unauthenticated -- no keys needed
- All new tables need RLS (user_id = auth.uid())
- Interview prep schema already exists -- just needs UI
- OpenPostings has Workday/iCIMS/Jobvite parsers -- can add later as Phase 6
- Company seed DB (~10,500) could power autocomplete -- future enhancement
