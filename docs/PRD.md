# Job Assistant ("Clock") — Product Requirements Document

> **Status**: In Development
> **Last Updated**: 2026-03-30

---

## Executive Summary

A job application assistant for UK graduate/entry-level roles. Built as **open core**: the full app is open source and self-hostable; a hosted commercial version adds managed infrastructure, covered AI costs, and cloud-only features (browser extension, future team accounts).

**Two goals**:
1. Never miss a relevant job — aggregate all sources, AI-tailored CV + cover letter for every application
2. Apply smarter — auto-apply where feasible, AI-prep everything else

**Core value chain**: Job browsing → AI CV + cover letter tailoring → Skills gap analysis → Apply (auto or one-click) → Track → Interview prep → Offer comparison

**Distribution model (Docker / open core reference)**:
- **Open source** — full Next.js app on GitHub, self-hostable, bring your own API keys, MIT or similar licence
- **Hosted (free tier)** — zero setup, limited monthly AI generations and job saves, no extension
- **Hosted (Pro, paid)** — unlimited usage, AI costs covered (no API key needed), browser extension access, priority support
- **Self-host** — always free, full feature set minus cloud-only features, user manages own API keys and infrastructure

**Non-negotiables**:
- No paid scraping services (Apify, SerpAPI, Browserless, etc.)
- No paid job board APIs beyond free tiers
- All AI costs on self-hosted plan come from user's own API key (Anthropic or OpenAI)
- Extension is cloud-only — requires hosted backend to parse and store jobs

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

### Phase D — Jobs Feed ✅ COMPLETE
- /jobs page: pre-fill search from preferences, source selector, experience level filter chips
- Adzuna (what_or for multi-level) + Reed + Careerjet API queries
- Experience level filtering: server-side (what_or / parallel queries) + client-side pass
- Save to pipeline from job card (URL-based dedup, persists across sessions)
- Pagination with cross-page dedup via seenUrlsRef
- Source badges, salary display, posted-at dates

### Phase E — Application Detail 🔄 IN PROGRESS
- /applications/[id] — status stepper, status update form ✅
- Editable job description (paste full description from job site) ✅
- Notes, base CV selector, cover letter template selector ✅
- Delete application ✅
- AI chat panel with full application context (job + CV) + web search ✅
- AI CV tailoring → generate button → HTML preview → PDF download 🔲
- AI cover letter generation → generate button → preview → download 🔲
- Skills gap analysis (job requirements vs. CV) 🔲

### Phase F — Auto-Apply 🔲
- Auto-apply rules in settings (on/off, daily limit)
- Playwright form fill for Easy Apply jobs
- Per-application tracking (auto_apply_attempted, auto_apply_success)
- Human-in-the-loop review step before any submission fires

### Phase H — Commercial / SaaS Infrastructure 🔲
- Stripe subscriptions (free + Pro tiers)
- Usage tracking table (AI generations, job saves per billing period)
- Quota enforcement middleware (check plan limits before AI calls)
- Upgrade prompts when limits hit
- Billing portal (manage subscription, cancel, invoices)
- Personal API token generation in Settings (for extension auth + self-host power users)
- Plan-gated feature flags (extension access, unlimited AI)
- Public landing page + pricing page

### Phase G — Browser Extension 🔲
- Chrome/Firefox extension (Manifest V3)
- One-click "Save to pipeline" on any job page (LinkedIn, Indeed, Glassdoor, company careers pages, etc.)
- Extension reads current page URL + full page text, sends to `/api/jobs/import`
- Claude parses raw page content → extracts title, company, location, salary, description
- Creates `jobs_cache` entry + `applications` record (status: saved)
- Auth via personal API token generated in Settings (paste once into extension)
- Extension popup shows extracted job preview before saving (confirm step)
- On save: shows "Saved → View application" deep-link into the app

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

## Pricing Tiers (TBD — to be confirmed before Phase H)

| Tier | Price | Limits | Notes |
|---|---|---|---|
| **Self-host** | Free forever | Unlimited (user pays own AI costs) | Open source, no extension |
| **Free (hosted)** | £0/mo | ~5 AI generations/mo, ~10 job saves/mo, no extension | Hosted, no API key needed |
| **Pro (hosted)** | TBD £/mo | Unlimited AI + saves, extension access | AI costs covered by platform |

Exact pricing and limits to be decided closer to launch. Extension access is the primary Pro upgrade incentive.

---

## Open Source / Commercial Boundary

| Feature | Self-host | Free (hosted) | Pro (hosted) |
|---|---|---|---|
| Job search (Adzuna, Reed) | ✅ | ✅ | ✅ |
| Application pipeline | ✅ | ✅ | ✅ |
| AI CV + cover letter generation | ✅ (own key) | ✅ (limited) | ✅ (unlimited) |
| AI chat on applications | ✅ (own key) | ✅ (limited) | ✅ (unlimited) |
| Browser extension | ❌ | ❌ | ✅ |
| Auto-apply (Phase F) | ✅ (own setup) | ❌ | ✅ |

---

## Key Decisions Log

| Decision | Reasoning |
|---|---|
| Open core model | Self-hosters build trust + community; hosted version monetises convenience and extension |
| Extension as cloud-only | Requires backend to parse pages + store jobs — natural Pro upgrade incentive |
| "Bring your own key" on self-host | Keeps self-host free, offloads AI cost to user |
| No paid scraping services | Cost doesn't justify it at any tier |
| Templates stored as DOCX (not HTML) | Preserves original formatting; mammoth conversion happens at generation time |
| docx-preview for template preview | Faithful rendering vs lossy mammoth HTML |
| Preferences as DB columns not JSONB | First-class fields (roles, locations, salary) queried directly; AI + job source config in JSONB |
| Drizzle for migrations | Type-safe schema, migration tracking — but type change migrations need manual USING clause |
| experience_level as TEXT[] | User may want graduate AND junior simultaneously |
| Custom URL scraping = user-defined filters | More reliable than auto-applying preferences to unknown job board UIs |
| PDF: Puppeteer not @react-pdf | Matches user's existing DOCX template design exactly |
