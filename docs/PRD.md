# Job Assistant ("Clock") - Feasibility Analysis & Implementation Plan

> **Status**: Feasibility & Architecture Planning Complete
> **Last Updated**: 2026-03-27

---

## Executive Summary

This document covers the technical feasibility of building an automated job application assistant tailored for UK graduate/entry-level roles. The system has two goals:

1. **Never lose a job opportunity** — browse all relevant jobs, get AI-generated CV + cover letter, track everything
2. **Apply smarter, not harder** — auto-apply where possible (Easy Apply, Quick Apply), AI-prep everything else so you just click submit

**Core value chain**: Job browsing → AI CV/cover letter customization → Skills gap analysis → Auto-apply (where feasible) / One-click prep (where not) → Application tracking → Interview prep → Offer comparison.

**Key architectural decision**: Use a two-track apply system — fully automate Easy Apply / Quick Apply (LinkedIn, Indeed, ZipRecruiter), and provide AI-prepped manual apply for everything else. This gives maximum automation with minimum complexity and legal risk.

**Phase 1-2 scope** (what gets built first): Project scaffold + CV upload + AI CV + cover letter generation + UK job browsing via Adzuna/Reed + basic tracking.

**Phase 3** adds smart auto-apply + job alerts.

**Phase 4** adds analytics, interview prep, and offer comparison.

**Phase 5** is polish + scale (extra job boards, ATS form-fill assist, GDPR tools).

---

## Capability 1: Job Browsing

### What You Want
Browse listings from LinkedIn, Indeed, Glassdoor, etc. for entry-level/graduate roles in Software Engineering, Software Development, and Project Management.

### Feasibility: HIGH

| Aspect | Assessment |
|--------|------------|
| Public job listings | Scrapable via RSS, search APIs, or HTML scraping |
| Login-required content | Possible but adds significant complexity |
| Job search APIs | Several free/cheap options exist |
| Legal risk | Low-moderate for personal use; moderate for redistribution |

### What Works Today

**APIs (recommended approach)**:
- **LinkedIn Jobs API** — Limited access via LinkedIn Talent Solutions (paid). No free public API for job search.
- **Indeed API** — Indeed Publisher Program gives limited job search access. Not free for commercial use.
- **Google Jobs** — Aggregates jobs from many boards via `site:jobs.google.com` or the unofficial SerpAPI (paid).
- **Jooble API** — Aggregator with an API. Free tier available.
- **Adzuna API** — UK/US job search API with a free tier.
- **ZipRecruiter API** — Application programming access available.
- **The Muse** — Public job board with API access for certain use cases.

**Scraping (more complex, higher risk)**:
- Playwright + Stealth plugins can scrape public search results
- Requires proxy rotation, rate limiting, and CAPTCHA handling
- High maintenance — sites change layouts frequently
- **Legal note**: scraping public job listings is generally not a CFAA violation (see hiQ v. LinkedIn), but violates most sites' ToS. For personal use, low risk. For a product, get legal counsel.

**Managed services**:
- **Apify** — Has pre-built LinkedIn, Indeed, Glassdoor scrapers (~$50-150/month). 80-88% success rate.
- **SerpAPI** — Google Jobs results only (~$50/month for 5K searches).

### Recommended Architecture
```
Public Job Search (Phase 1):
  - ZipRecruiter / Adzuna / Jooble API (primary sources)
  - Google Jobs via SerpAPI (secondary)
  - Simple job schema normalization (title, company, location, URL, description)

Advanced Job Search (Phase 2):
  - Apify LinkedIn scraper (or similar) for login-required content
  - Stealth Playwright for fallback scraping
  - Redis job dedup cache before storage
```

---

## Capability 2: CV/Resume Management with AI Customization

### What You Want
Store a base CV and have AI customize it for each job (ATS keyword optimization, reformatting for job fit).

### Feasibility: HIGH

| Aspect | Assessment |
|--------|------------|
| AI customization | GPT-4/Claude are excellent at this today |
| ATS optimization | Well-understood problem with known techniques |
| Existing tools | Rezi, WriteCV, Kickresume, Teal, Jobscan all do this |
| File parsing | PDF/DOCX parsing is reliable with libraries |
| Privacy | CVs contain personal data — must be handled carefully |

### What Works Today

**AI Customization**:
- **GPT-4o / Claude Sonnet** — Both are excellent at reformatting resumes to match job descriptions, extracting keywords, and rewriting bullet points. Context window (200K tokens) easily handles a full CV + job description.
- **Fine-tuned cover letter models** — OpenAI and Anthropic both offer fine-tuning capabilities, but base models with good prompting achieve 95%+ of the quality for this use case.
- **Prompt engineering pattern**: Inject the job description + base CV into a structured prompt asking for: (a) ATS keyword extraction, (b) rewritten bullet points, (c) suggested section ordering.

**ATS Optimization**:
- ATS systems parse resumes looking for keyword matches against job descriptions.
- Best practices are well-documented: single-column layouts, standard section headings, no tables/graphics, keyword density of 2-5%.
- Tools like **Jobscan** (paid) and **Resume Worded** (paid) provide ATS scoring APIs.

**CV Parsing Libraries**:
- **pdf-parse** / **pdf.js** — Extract text from PDFs
- **mammoth** — Extract text from DOCX files
- **Docling** — Strong multi-format document parsing (PDF, DOCX, images)
- **Marker** — PDF to markdown conversion (good for ATS parsing)

**File Storage**:
- Base CV stored as JSON (parsed, structured) + original file
- Customized CVs generated on-demand (not pre-stored) or cached per job-ID

### Recommended Architecture
```
CV Storage:
  - User uploads base CV (PDF/DOCX)
  - Docling/Marker parses to structured JSON
  - JSON stored in DB (Supabase or PostgreSQL)

AI Customization Pipeline:
  - LLM (Claude/GPT-4o) receives: base CV JSON + job description text
  - LLM outputs: customized CV JSON (ATS-optimized)
  - Renderer converts JSON back to PDF/DOCX using a templating library
  - PDF returned to user for download/upload

Supported ATS Techniques:
  - Keyword extraction (TF-IDF or LLM-based)
  - Section reordering (Skills → Experience → Education)
  - Bullet point rewriting with quantified achievements
  - Format normalization (dates, titles, formatting)
```

---

## Capability 3: Cover Letter Generation

### What You Want
Generate personalized cover letters for each job application automatically.

### Feasibility: HIGH

| Aspect | Assessment |
|--------|------------|
| AI generation | GPT-4o/Claude produce high-quality cover letters |
| Personalization | LLM can incorporate user's background + job specifics |
| Quality variance | Requires good prompts and user review step |
| Integration | Can be bundled with CV customization pipeline |

### What Works Today

**AI Generation**:
- Similar to CV customization — structured prompts with base CV + job description
- **Prompt strategy**: Extract user's top 3 achievements relevant to the role → weave into a 3-4 paragraph letter
- Tone control is possible (professional, enthusiastic, conservative)
- Word count and format (paragraph vs. bullet) controllable via prompt

**Tools that do this**:
- Grammarly, Jobscan, Kickresume, AIApply all offer cover letter generation
- Any LLM API (OpenAI, Anthropic, Google Gemini) can do this with proper prompting

### Recommended Architecture
```
Cover Letter Pipeline:
  1. Extract job description → LLM → Key requirements list
  2. Extract user's relevant background from CV → LLM → 3-5 relevant points
  3. Generate letter: Hook (personal connection) → Body (alignment) → Call to action
  4. User reviews and edits before submission
  5. Store final version linked to application record
```

---

## Capability 4: Job Tracking & Duplicate Avoidance

### What You Want
Track all applied jobs, prevent duplicate applications, provide status dashboards.

### Feasibility: VERY HIGH

| Aspect | Assessment |
|--------|------------|
| Complexity | Low — relational data with a good schema |
| Duplicate detection | Hash-based (URL + date + company) is highly reliable |
| Dashboarding | Standard React/BI tools handle this well |
| Status updates | Most sites don't expose application status (only ATS confirmations) |

### What Works Today

**Application Tracking Schema**:
```
Application {
  id: UUID
  user_id: UUID
  job_url: string (unique constraint)
  company: string
  job_title: string
  applied_at: timestamp
  status: enum (saved, applied, screening, interview, offer, rejected, withdrawn)
  source: enum (linkedin, indeed, ziprecruiter, manual)
  cover_letter_id: UUID (optional)
  customized_cv_id: UUID (optional)
  notes: text
  last_status_update: timestamp
}
```

**Duplicate Detection**:
- Hash of `canonicalize(job_url)` catches most duplicates
- Fuzzy match on `(company, job_title, applied_date)` as fallback
- The "applied" status can only be set manually (since most sites don't expose this)

**Dashboarding**:
- Simple analytics: total applied, by status, by company, by week
- Response rate, time-to-response metrics
- Pipeline funnel visualization

### Recommended Architecture
```
Supabase PostgreSQL:
  - applications table
  - user_cvs table (base CVs)
  - customized_cvs table (per-job versions)
  - cover_letters table
  - jobs_cache table (normalized job listings)

Frontend:
  - Dashboard: application stats, funnel, timeline
  - Application list with filters and search
  - Job detail view with CV/cover letter attachment
  - Settings: base CV management
```

---

## Capability 5: Smart Auto-Apply (Selectively Automated)

### What You Want
Auto-apply to jobs where it's feasible — LinkedIn Easy Apply, Indeed Quick Apply — while prep work (CV + cover letter) is always AI-generated.

### Feasibility: HIGH (with smart scope limits)

| Aspect | Assessment |
|--------|------------|
| Easy Apply / Quick Apply | Highly automatable — structured forms, no CAPTCHAs |
| Full ATS applications (Greenhouse, Lever) | Complex, high maintenance — skip for now |
| LinkedIn Easy Apply | Automatable with Apify or Playwright stealth |
| Indeed Quick Apply | Automatable — simpler form structure |
| Manual apply required | Full CV/cover letter prep done, user clicks apply |

### Strategy: The Two-Track Approach

**Track A — Auto-Apply (where possible)**:
- LinkedIn Easy Apply
- Indeed Quick Apply
- ZipRecruiter one-click apply
- Any job board with a structured, form-based apply flow

**Track B — AI Prep, Manual Apply (everything else)**:
- Full CV tailored to the job (AI)
- Cover letter written (AI)
- Application checklist generated
- User clicks apply themselves on the company site or ATS (Greenhouse, Lever, Workday, etc.)

This means:
- You ALWAYS get the AI CV + cover letter prep
- You get auto-apply for the easy ones without thinking
- For complex applications, everything is pre-filled and ready — you just hit submit

**Realistic success rates**:
| Apply Type | Automation Level | Success Rate |
|------------|-----------------|--------------|
| LinkedIn Easy Apply | Full auto | ~85% |
| Indeed Quick Apply | Full auto | ~90% |
| Manual company site | AI prep only | N/A |
| ATS (Greenhouse, Lever) | AI prep + form fill assist | ~60% |

### Auto-Apply Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION WORKFLOW                      │
│                                                              │
│  Job Found ──► AI CV+CL Generated ──► Check Apply Type      │
│                                           │                  │
│                    ┌──────────────────────┴────────────────┐  │
│                    │                                     │  │
│               Easy Apply?                           Complex?│  │
│                    │                                     │  │
│          ┌─────────▼─────────┐               ┌───────────▼──┤
│          │  AUTO-APPLY       │               │ AI PREP ONLY │
│          │  (Apify/Playwright│               │ User clicks  │
│          │   stealth)        │               │ apply herself │
│          └───────────────────┘               └──────────────┘
└─────────────────────────────────────────────────────────────┘
```

### CAPTCHA Handling (for auto-apply only)
- **Browserless** — Built-in CAPTCHA solving for ~$49+/month (only needed for auto-apply track)
- Easy Apply / Quick Apply forms rarely have CAPTCHAs — this cost may be zero
- Skip CAPTCHA solving entirely for Phase 1-2; add only if auto-apply success rate drops

### Legal Note
- LinkedIn Easy Apply and Indeed Quick Apply are designed for high-volume apply flows — they explicitly support this use case
- Auto-applying to company career pages via ATS forms is higher risk (ToS varies)
- For personal use: low risk across the board
- Always include a human review step ("Review and Submit") before auto-apply fires

---

## Tech Stack Recommendations

Based on the detected workspace (empty project, likely personal use) and the capabilities above:

### Core Stack

| Layer | Recommendation | Rationale |
|-------|---------------|-----------|
| **Frontend** | Next.js 15 + React 19 | App router, server components, great DX |
| **Styling** | Tailwind CSS | Rapid UI development |
| **Database** | Supabase (PostgreSQL) | Auth, database, storage, edge functions in one |
| **AI** | Anthropic Claude (via API) | Best-in-class for document generation |
| **File Storage** | Supabase Storage | Native to Supabase, easy CV storage |
| **Background Jobs** | Supabase Edge Functions + pg_cron | CV generation, scheduled scraping |
| **Web Scraping** | Playwright (stealth) + Apify | Primary + fallback |
| **Search** | Supabase pgvector | Store job embeddings for similarity search |
| **PDF Generation** | @react-pdf/renderer or Puppeteer | Generate customized CV PDFs |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      USER INTERFACE                      │
│  Dashboard │ Job Search │ CV Editor │ Applications     │
└──────────────────┬──────────────────────────────────────┘
                   │ HTTP / WebSocket
┌──────────────────▼──────────────────────────────────────┐
│                   NEXT.JS APP ROUTER                     │
│  Route Handlers │ Server Actions │ Middleware           │
└────┬─────────────────┬──────────────────┬────────────────┘
     │                 │                  │
┌────▼────┐     ┌──────▼──────┐   ┌───────▼───────┐
│Supabase │     │  AI Service │   │ Job Scraping  │
│Auth +   │     │  (Claude    │   │  (Playwright  │
│Database │     │   API)      │   │   + Apify)    │
└────┬────┘     └─────────────┘   └───────────────┘
     │
┌────▼───────────────────────────────────────────────────┐
│              EXTERNAL SERVICES                          │
│  LinkedIn │ Indeed │ ZipRecruiter │ Google Jobs │ ATS   │
└─────────────────────────────────────────────────────────┘
```

### UK-Specific Considerations

Since the user is based in the UK targeting UK graduate/entry-level roles:

| Feature | Why it matters |
|---|---|
| **Adzuna API** | UK-focused job board with a generous free tier — ideal primary source |
| **Reed API** | Another major UK job board — strong volume of graduate roles |
| **LinkedIn UK** | Filter by "Easy Apply" to find automatable jobs |
| **Right to work check** | UK roles often ask "do you have the right to work in the UK?" — flag this in the prep checklist |
| **CV formatting** | UK CVs typically: no photo, 2 pages max, "References available on request", reverse chronological |
| **Cover letter norms** | UK cover letters: 3-4 paragraphs, formal sign-off ("Yours sincerely/faithfully"), A4 format |

### UK Job Boards to Integrate
- **Adzuna** — Primary UK source (free API tier)
- **Reed** — Secondary UK source
- **LinkedIn UK** — Filtered by location + Easy Apply
- **Indeed UK** — Quick Apply filtering
- **Glassdoor UK** — Company intel (ratings, salaries)
- **CWJobs** — Tech-specific UK job board

---

## Additional Capabilities

### Skills Gap Analysis
When a job is saved, automatically compare job requirements to the user's CV and show:
- Keywords present in both (strengths)
- Keywords the job wants that aren't in the CV (gaps)
- Suggestions for how to address gaps (e.g., "Add AWS experience — even a personal project counts")

This helps users prioritize applications and know which CVs to invest in tailoring.

### Application Quality Score
Before any application fires (auto or manual), rate it on:
- CV tailored for this job? (yes/no/partially)
- Cover letter personalized? (yes/no)
- All required fields identified and filled?
- Right-to-work check confirmed?

Score: 0-100%. Warn if score is below threshold.

### Company Intel Panel
Before applying, show the user:
- Salary range (from job posting or Glassdoor UK)
- Company size / funding stage / industry
- Glassdoor rating (out of 5)
- "Why I fit" summary (AI-generated: 2-3 bullets on alignment)

### Interview Prep Trigger
When application status moves to `interview`:
1. Extract key requirements from the original job description
2. Generate 5-10 likely interview questions
3. Generate suggested answers based on the user's CV
4. Save to the application record for reference

### Offer Comparison Tracker
When a user gets an offer, collect:
- Base salary
- Bonus (% or £ amount)
- Equity (shares / options)
- Benefits (pension %, healthcare, etc.)
- Location / remote policy
- Start date

Visual comparison across all offers. Suggested negotiation talking points based on market data.

---

## Data Model

```
users
  id, email, created_at, preferences (JSONB), right_to_work_uk (boolean)
  location_uk (string), desired_roles (text[]), target_salary_min

applications
  id, user_id, job_id, status, applied_at,
  cover_letter_id, customized_cv_id, source,
  notes, tags (text[]), created_at, last_status_update
  auto_apply_attempted (boolean), auto_apply_success (boolean)
  application_quality_score (int), right_to_work_confirmed (boolean)

jobs_cache
  id, url (unique), source, title, company, location,
  description, salary_min, salary_max, salary_currency,
  posted_at, scraped_at, embedding (vector)
  is_easy_apply (boolean), apply_deadline (date)

user_cvs
  id, user_id, original_file_path, parsed_json (JSONB),
  file_path, created_at, is_primary (boolean)

customized_cvs
  id, user_id, application_id, cv_json (JSONB),
  pdf_path, ats_score (int), skills_gap (JSONB), created_at

cover_letters
  id, user_id, application_id, content (text),
  tone (enum: professional, enthusiastic, conservative),
  created_at, reviewed (boolean)

interview_prep
  id, application_id, questions (text[]),
  suggested_answers (JSONB), created_at

offers
  id, user_id, application_id, company, role,
  base_salary, bonus, equity, benefits (JSONB),
  remote_policy, start_date, negotiation_notes (text)
```

---

## Phased Implementation Plan

### Phase 1: Foundation (Weeks 1-3)
**Goal**: Working job browsing + CV management + basic tracking

- [ ] Project scaffolding (Next.js 15, Tailwind, Supabase)
- [ ] User authentication (Supabase Auth)
- [ ] Database schema (applications, jobs_cache, user_cvs, cover_letters)
- [ ] Upload and store base CV (PDF/DOCX)
- [ ] CV parser → structured JSON (Docling/Marker)
- [ ] Manual job search via Adzuna API (UK-focused)
- [ ] Job listing UI with search and filters (location, salary, title, date)
- [ ] Basic application tracking dashboard
- [ ] Application status updates (saved, applied, screening, interview, offer, rejected)

**Deliverable**: User can browse UK jobs, upload CV, save jobs to track.

---

### Phase 2: AI CV Customization + Cover Letters (Weeks 4-6)
**Goal**: ATS-optimized CV and cover letter generation for every job

- [ ] Claude API integration for CV customization
- [ ] ATS keyword extraction pipeline (job description → keywords)
- [ ] Skills gap analysis (job requirements vs. user CV)
- [ ] Customized CV PDF generation (@react-pdf/renderer)
- [ ] Cover letter generation pipeline
- [ ] Company intel panel (salary range, company size, rating)
- [ ] "Why I fit" summary auto-generated by AI
- [ ] User review step before download/submission

**Deliverable**: User pastes a job URL/description, gets a tailored CV, cover letter, and application checklist.

---

### Phase 3: Smart Auto-Apply + Job Alerts (Weeks 7-10)
**Goal**: Automate easy applies, never miss a relevant job

- [ ] LinkedIn Easy Apply auto-apply (Apify or Playwright stealth)
- [ ] Indeed Quick Apply auto-apply
- [ ] Two-track system: auto-apply vs. AI-prep-manual-apply
- [ ] Application quality score (CV tailored? CL written? All fields filled?)
- [ ] Daily/weekly job alert emails (Adzuna/Reed/Jooble API)
- [ ] Job dedup and caching
- [ ] pgvector similarity search ("jobs like this")
- [ ] Interview prep trigger (auto-generate questions when status → interview)

**Deliverable**: Auto-apply works for Easy Apply jobs. All other applications are pre-prepped and ready to submit.

---

### Phase 4: Tracking Analytics + Offer Management (Weeks 11-13)
**Goal**: Full visibility into your job search

- [ ] Full application funnel analytics (saved → applied → response → offer)
- [ ] Time-to-response metrics
- [ ] Company-specific analytics (which companies respond most)
- [ ] Response rate by job type, company size, location
- [ ] Offer comparison tracker (salary, bonus, equity, benefits)
- [ ] Application history export (CSV)
- [ ] Notes and tagging per application
- [ ] Interview prep question bank (generated from past job descriptions)

**Deliverable**: Full ATS for the job seeker with analytics and offer comparison.

---

### Phase 5: Scale + Polish (Weeks 14+)
**Goal**: Scale reliability and add nice-to-haves

- [ ] Browserless CAPTCHA solving (only if auto-apply success drops)
- [ ] Additional job board integrations (Glassdoor, Reed, CWJobs)
- [ ] ATS form-fill assist (Greenhouse, Lever — pre-fill from your data)
- [ ] LinkedIn profile optimization suggestions
- [ ] Salary negotiation tips based on offer data
- [ ] Data export / account deletion (GDPR compliance)

---

## Key Challenges and Mitigations

### Challenge 1: LinkedIn's Anti-Bot Defenses
**Risk**: High
**Mitigation**:
- Don't try to scrape LinkedIn directly in Phase 1
- Use ZipRecruiter, Adzuna, Jooble as primary sources
- In Phase 5, use Apify's managed scraper (not DIY)
- Never attempt to circumvent CAPTCHA on LinkedIn without legal counsel

### Challenge 2: ATS Keyword Optimization Accuracy
**Risk**: Medium
**Mitigation**:
- Use structured prompts with known-good examples
- Include user review step — never submit automatically
- Validate output with Jobscan or similar before generation
- Allow manual editing of generated CV before storage

### Challenge 3: CV Privacy and Data Security
**Risk**: Medium (GDPR, personal data)
**Mitigation**:
- Store CVs encrypted at rest (Supabase handles this)
- Never send CV data to third parties beyond the AI provider
- Implement data retention policies (user can delete all data)
- Clear consent flow for data storage

### Challenge 4: Job Site ToS Changes
**Risk**: High (layouts break scrapers, ToS change)
**Mitigation**:
- Use official APIs where available
- Design scrapers to be fault-tolerant and alerting
- Monitor scraper success rates and auto-alert on degradation
- Budget for Apify/managed services as reliable fallback

### Challenge 5: Duplicate Applications
**Risk**: Medium (user error or automation bugs)
**Mitigation**:
- Hash-based dedup on `(canonical_url, user_id)` — enforced at DB level
- Fuzzy match secondary check on `(company, title, applied_date)`
- Clear "Already applied" warning in UI before double-submission

### Challenge 6: Maintaining Session Auth for Job Sites
**Risk**: High (sessions expire, cookies rotate)
**Mitigation**:
- Never rely on long-term session storage for job applications
- In Phase 5, use fresh login sessions per application flow
- Implement session refresh logic with alert on failure
- Consider dedicated accounts for automation (easier to manage)

---

## What to Build First

### Week 1-2: Project Foundation
1. Scaffold Next.js 15 + TypeScript + Tailwind project
2. Set up Supabase project (auth + database)
3. Create database schema (applications, jobs_cache, user_cvs, cover_letters, offers)
4. Implement Supabase Auth (email/password + magic link)
5. Build basic layout: header, sidebar, main content
6. Upload CV → Docling parse → store as structured JSON

### Week 3-4: CV Management + AI Integration
1. Claude API integration for CV customization
2. Cover letter generation pipeline
3. Skills gap analysis (job requirements vs. CV)
4. Custom CV PDF generation (downloadable)
5. UK CV formatting (2-page max, no photo, standard sections)
6. Company intel panel (Adzuna salary data + Glassdoor ratings)

### Week 5-6: Job Browsing + Tracking
1. Integrate Adzuna API (UK primary) + Reed API (UK secondary)
2. LinkedIn UK job search (via Apify or direct search)
3. Job listing UI with UK-specific filters (location, salary, remote, contract type)
4. Application creation flow (link job + CV + cover letter)
5. Application tracking dashboard with funnel view
6. Right-to-work check reminder in application checklist

### Week 7-8: Smart Auto-Apply
1. Detect Easy Apply vs. complex application type
2. Auto-apply for LinkedIn Easy Apply (Apify)
3. Auto-apply for Indeed Quick Apply
4. Application quality score before any submission
5. Human-in-the-loop review step ("Review and Submit")
6. Job alert emails (Adzuna/Reed)

### Week 9-10: Interview Prep + Offers
1. Interview question generator (triggered on status → interview)
2. Offer tracker with salary/benefits comparison
3. Response rate analytics by company, role, source
4. Application history export (CSV)

---

## Summary Recommendation

**Start with Phases 1-3.** These deliver the most user value (job browsing, AI CV customization, tracking) with the lowest technical risk and no legal exposure. Phase 5 (auto-apply) should only be attempted after the core product is validated and you have a clear understanding of the maintenance burden.

The single most important technical decision is: **use official APIs wherever possible and treat scraping as a fallback, not the primary approach.** This keeps maintenance costs predictable and legal risk minimal.

---

## Sources

- [LinkedIn Scraping in 2026: API Benchmarks, Legal Risks, and What Actually Works](https://dev.to/agenthustler/linkedin-scraping-in-2026-api-benchmarks-legal-risks-and-what-actually-works-2ldc)
- [Web Scraping Legal Guide 2026: What's Allowed and What's Not](https://dev.to/agenthustler/web-scraping-legal-guide-2026-whats-allowed-and-whats-not-e00)
- [How to Scrape Indeed in 2026: Job Listings, Salaries, and Company Reviews](https://dev.to/agenthustler/how-to-scrape-indeed-in-2026-job-listings-salaries-and-company-reviews-264o)
- [How to Scrape LinkedIn Jobs in 2026 (Without Getting Banned)](https://dev.to/agenthustler/how-to-scrape-linkedin-jobs-in-2026-without-getting-banned-2g57)
- [Best Resume Builders in 2026: Tools That Beat ATS Parsing](https://www.techtimes.com/articles/315076/20260310/best-resume-builders-2026-tools-that-beat-ats-parsing-without-killing-design.htm)
- [Playwright vs Puppeteer vs Selenium: 2026 Comparison for Web Scraping](https://dev.to/agenthustler/playwright-vs-puppeteer-vs-selenium-2026-comparison-for-web-scraping-4i92)
- [Bypassing CAPTCHA with Playwright in 2026](https://www.browserstack.com/guide/playwright-captcha)
- [Auto Apply API - Jobo Data](https://jobo.world/api/auto-apply)
- [ATS API - Unified.to](https://docs.unified.to/ats/overview)
- [AI Cover Letter Generator | Grammarly](https://www.grammarly.com/ai/ai-writing-tools/cover-letter-generator)
- [Jobscan AI Cover Letter](https://www.jobscan.co/cover-letter-generator)
