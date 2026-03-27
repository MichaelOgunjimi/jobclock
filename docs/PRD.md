# Job Assistant ("Clock") — Product Requirements Document

> **Status**: In Development
> **Last Updated**: 2026-03-27

---

## Executive Summary

An automated job application assistant for UK graduate/entry-level roles. Personal use — no external paid services beyond hosting.

**Two goals**:
1. Never miss a relevant job — aggregate all sources, AI-tailored CV + cover letter for every application
2. Apply smarter — auto-apply where feasible, AI-prep everything else

**Core value chain**: Job browsing → AI CV + cover letter tailoring → Skills gap analysis → Apply (auto or one-click) → Track → Interview prep → Offer comparison

**Non-negotiables**:
- No paid scraping services (Apify, SerpAPI, Browserless, etc.)
- No paid job board APIs beyond free tiers
- Free hosting until scale demands otherwise (Vercel free tier)
- All AI costs come from user's own API key (Anthropic or OpenAI)

---

## Architecture Overview

```
User Preferences (roles, locations, salary, experience level)
        │
        ▼
Job Sources (configured in Settings)
  ├── Adzuna API (free tier — primary UK source)
  ├── Reed API (free registration — secondary UK source)
  └── Custom URLs (user-pasted job board search URLs, Playwright scrape)
        │
        ▼
jobs_cache table (deduplicated by URL)
        │
        ▼
Jobs Feed (/jobs) — filtered by preferences, browsable
        │
        ▼
Save to Application → AI tailors CV + cover letter → PDF generation
        │
        ▼
Applications tracker → Status pipeline → Interview prep → Offer comparison
```

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.2.1 (App Router) | React 19, TypeScript strict |
| Styling | Tailwind CSS v4 | Custom design system, no component library |
| UI primitives | @base-ui/react v1.3.0 | Tabs use `data-[active]` not `data-[selected]` |
| Database | Supabase (PostgreSQL) | Auth + DB + Storage in one |
| ORM | Drizzle ORM | schema.ts → db:generate → db:migrate |
| AI | Anthropic Claude / OpenAI | User's own API key, configured in Settings |
| PDF generation | Puppeteer (Phase E) | HTML/CSS → PDF, ATS-friendly |
| Scraping | Playwright (Phase D) | Custom URL scraping only — no LinkedIn/Indeed |
| Storage | Supabase Storage | CVs bucket, templates bucket (private, per-user RLS) |

### Drizzle migration rules
- Edit `src/lib/db/schema.ts` → `npm run db:generate` → inspect SQL → `npm run db:migrate`
- `DATABASE_DIRECT_URL` = direct connection (port 5432) — used by drizzle-kit only
- `DATABASE_URL` = transaction pooler (port 6543) — used by app runtime
- Type change migrations (`ALTER COLUMN SET DATA TYPE`) require a manual `USING` clause — Drizzle omits it and the migration fails silently without it

---

## Data Model

```
profiles
  id, email, created_at
  preferences (JSONB) — AI settings + job_sources config
  right_to_work_uk (boolean)
  locations_uk (text[])         ← multiple preferred UK cities
  desired_roles (text[])        ← multiple role titles
  experience_level (text[])     ← ["graduate", "junior", "mid", "senior"]
  target_salary_min (numeric)
  cv_template_path (text)       ← path in templates bucket (DOCX)
  cover_letter_template_path (text)

user_cvs
  id, user_id, name
  original_file_path, parsed_json (JSONB), file_path
  created_at, is_primary (boolean)

jobs_cache
  id, url (unique), source, title, company, location
  description, salary_min, salary_max, salary_currency
  posted_at, scraped_at, is_easy_apply, apply_deadline

applications
  id, user_id, job_id → jobs_cache
  status (enum: saved|applied|screening|interview|offer|rejected|withdrawn)
  applied_at, cover_letter_id, customized_cv_id
  source, notes, tags (text[])
  auto_apply_attempted, auto_apply_success
  application_quality_score, right_to_work_confirmed

cover_letters
  id, user_id, application_id (null = profile template)
  label, content, tone (text), reviewed

customized_cvs
  id, user_id, application_id
  cv_json (JSONB), pdf_path, ats_score, skills_gap (JSONB)

interview_prep
  id, application_id, questions (text[]), suggested_answers (JSONB)

offers
  id, user_id, application_id
  company, role, base_salary, bonus, equity
  benefits (JSONB), remote_policy, start_date, negotiation_notes
```

---

## Job Sources

### Supported (free, no paid tier needed)

| Source | Type | Notes |
|---|---|---|
| **Adzuna** | REST API | Free tier (1k req/day). `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` env vars. Already implemented. |
| **Reed** | REST API | Free registration at reed.co.uk/developers. API key stored in preferences. |
| **Custom URLs** | Playwright scrape | User pastes any job board search URL (Totaljobs, CWJobs, Guardian Jobs, etc.) with their own filters in the URL. Scraped on schedule. |

### Not supported
- LinkedIn — no free API, aggressive anti-bot defences
- Indeed — deprecated public API, aggressive scraping blocks
- Google Jobs — no free API (SerpAPI is paid ~$50/month)
- Any managed scraping service (Apify, etc.) — costs money

### Filter strategy
- **Adzuna + Reed**: filters applied from user preferences (roles, locations, salary, experience level) automatically
- **Custom URLs**: filters are in the URL itself — user constructs the search URL with their desired filters on the job board, then pastes it

---

## Phase Plan

### Phase A — Foundation & CV Management ✅ COMPLETE
- Auth, dashboard shell, Supabase setup, Drizzle ORM
- Multiple CVs: upload PDF/DOCX, AI parsing, editor, set primary
- UI component library

### Phase B — Profile Tabs ✅ COMPLETE
- /profile with URL-persisted tabs: CVs / Cover Letters / Preferences
- Cover letter templates (CRUD, file upload to parse content, tones)
- Preferences: tag inputs for roles + locations, experience level multi-select, salary, right to work

### Phase C — Settings ✅ COMPLETE
- Settings with URL-persisted tabs: AI / Documents / Job Sources
- AI provider + model selector, API key management
- CV + cover letter DOCX template upload (stored in Supabase Storage, previewed with docx-preview)
- Job sources: Adzuna toggle, Reed API key, custom URL manager

### Phase D — Jobs Feed 🔲 NEXT
- Redesign /jobs page: pre-fill search from preferences, source selector, experience level filter
- Adzuna + Reed API queries driven by configured sources + preferences
- Cache results in jobs_cache (deduplication by URL)
- Job states: unseen → saved → dismissed
- Playwright scraping for custom URLs
- Cron/scheduled refresh (Supabase pg_cron or Vercel cron)
- Manual "Refresh now" button

### Phase E — Application Detail 🔲
- /applications/[id] — job info, status timeline
- AI selects best-fit CV + cover letter template from profile
- AI rewrites CV for the job (customized_cvs — base CV untouched)
- AI writes tailored cover letter (cover_letters with application_id)
- HTML/CSS from DOCX template → Puppeteer → downloadable PDF
- Edit AI output, regenerate individual sections
- Skills gap analysis (job requirements vs. CV)
- Application quality score

### Phase F — Auto-Apply 🔲
- Auto-apply rules in settings (on/off, daily limit)
- Playwright form fill for Easy Apply jobs
- Per-application tracking (auto_apply_attempted, auto_apply_success)
- Human-in-the-loop review step before any submission fires

---

## Jobs Page Redesign (Phase D)

The current /jobs page is a blank search box. It needs to become preference-aware:

**Key changes from current:**
- Server component fetches user preferences → pre-populates search filters on load
- Source selector: show only sources the user has enabled (Adzuna / Reed / custom)
- Experience level filter chips (from preferences, adjustable per-search)
- Job cards show source badge (Adzuna / Reed / Totaljobs etc.)
- Job state buttons: Save (→ pipeline) / Dismiss
- Already-saved jobs show "Saved" badge
- Results from jobs_cache where available (fast), fallback to live API

---

## PDF Generation Approach (Phase E)

1. User uploads DOCX template (Harvard CV format or their own)
2. DOCX stored as-is in Supabase Storage (`templates` bucket)
3. At generation time: DOCX → mammoth → HTML/CSS with placeholder variables
4. AI fills placeholders with tailored content
5. Puppeteer renders HTML → PDF download
6. Packages: `puppeteer-core` + `@sparticuz/chromium-min`

ATS-friendly output: clean semantic HTML, no images in content, keyword-matched to job description.

---

## AI Content Rules (Phase E)

- Prompt tuning over hard code limits
- Only generate sections that exist in the user's base CV
- Content budget via prompt (~2-3 bullets per job, ~10-12 skills)
- Target 1 page by default (configurable)
- No summary section if base CV has no summary
- Tone, length, and format controlled by preferences + job type

---

## UK-Specific Notes

| Feature | Detail |
|---|---|
| CV format | No photo, 2 pages max, reverse chronological, "References available on request" |
| Cover letter | 3-4 paragraphs, formal sign-off ("Yours sincerely"), A4 format |
| Right to work | Flag in application checklist — many UK roles ask this upfront |
| Salary | Display in GBP, filter by minimum salary |
| Experience bands | Graduate / Entry Level, Junior (1-3 yrs), Mid (3-5 yrs), Senior (5+ yrs) |
| Primary job boards | Adzuna (free API), Reed (free API), Totaljobs, CWJobs, Guardian Jobs (custom URL) |

---

## Key Decisions Log

| Decision | Reasoning |
|---|---|
| No paid scraping services | Personal use — cost doesn't justify it |
| Templates stored as DOCX (not HTML) | Preserves original formatting; mammoth conversion happens at generation time |
| docx-preview for template preview | Faithful rendering vs lossy mammoth HTML |
| Preferences as DB columns not JSONB | First-class fields (roles, locations, salary) queried directly; AI + job source config in JSONB |
| Drizzle for migrations | Type-safe schema, migration tracking — but type change migrations need manual USING clause |
| experience_level as TEXT[] | User may want graduate AND junior simultaneously |
| Custom URL scraping = user-defined filters | More reliable than auto-applying preferences to unknown job board UIs |
| PDF: Puppeteer not @react-pdf | Matches user's existing DOCX template design exactly |
