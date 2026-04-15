# Career-Ops → Job-Assistant: Feature Analysis & Adaptation Plan

## What is Career-Ops?

An open-source, AI-powered job search automation system built on Claude Code by Santiago Fernández. It's a CLI/TUI tool that automates job discovery, evaluation, CV tailoring, and interview prep. Key stats: evaluated 740+ offers, generated 100+ tailored CVs.

**Tech stack**: Node.js scripts (.mjs) + Claude CLI + Playwright + Go TUI dashboard + Markdown/YAML/TSV data files.

---

## Feature Comparison

| Feature | Career-Ops | Job-Assistant | Gap |
|---------|-----------|---------------|-----|
| **Job Sources** | Greenhouse, Ashby, Lever, BambooHR, Workday, TeamTailor APIs + Playwright crawl + WebSearch | Adzuna, Reed, Careerjet APIs | Major — no direct ATS board scraping |
| **Freshness** | scan-history.tsv with first_seen dates, dedup across scans | postedAt from APIs, no freshness UX | Medium — data exists but not surfaced |
| **Deduplication** | URL + fuzzy title/company matching (60% keyword overlap) | URL-only (cross-source) + client-side seenUrls | Medium — misses same job on different boards |
| **Title Filtering** | Positive/negative keyword config | Experience level chips (client-side regex) | Small — could add keyword filters |
| **Ghost Job Detection** | Block G: posting age, description quality, hiring signals, repost patterns | None | Large — unique and valuable |
| **Company Tracking** | portals.yml with 45+ companies, per-company enable/disable | None — only API search | Large — no saved companies |
| **CV Tailoring** | Keyword injection, archetype detection, ATS normalization | AI multi-stage pipeline (Stages B-E) | Different approach — JA is more sophisticated |
| **Interview Prep** | Story bank (STAR+R), company research, Glassdoor/Blind intel | Schema exists, minimal UI | Large — schema ready, needs UI + AI |
| **Follow-up Tracking** | Cadence rules (Applied→7d, Responded→1d, Interview→1d) | None | Medium — useful for active job seekers |
| **Analytics** | Pattern analysis: funnel, conversion rates, archetype breakdown | Basic status counts on dashboard | Medium — data exists, needs visualization |
| **PDF Generation** | ATS-optimized: Unicode normalization, single-column, standard headers | Playwright HTML→PDF | Small — add Unicode normalization |
| **Evaluation** | 7-block structured assessment (A-G) | AI CV matching + tailoring plan | Different — career-ops is more structured |
| **Batch Processing** | Parallel Claude workers for bulk evaluation | Single application at a time | N/A — different paradigm |
| **Dashboard** | Go TUI with Bubble Tea | Next.js web dashboard | N/A — web is better for our use case |

---

## What to Adapt (Prioritized)

### Tier 1: High Impact, Realistic to Build

#### 1. Direct ATS Board Integration (Greenhouse, Lever, Ashby)
**What career-ops does**: Calls public JSON APIs for company job boards — zero auth needed.
- Greenhouse: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs`
- Lever: `https://api.lever.co/v0/postings/{company}`
- Ashby: GraphQL `ApiJobBoardWithTeams` query

**Adaptation**: Add as new job sources in `src/lib/jobs/`. Users can add companies by slug/URL in settings.

**Why it matters**: These are the freshest possible listings — direct from company ATS, not aggregated through job boards with delay. Solves the "not getting fresh ones" problem.

**Effort**: Medium — 3 new source files + settings UI for managing tracked companies + API route changes.

#### 2. Company Tracking / Saved Companies
**What career-ops does**: `portals.yml` with company name, careers URL, API endpoint, enabled flag.

**Adaptation**: New `tracked_companies` table. Settings page to add/remove companies. Background check for new jobs (or on-demand scan).

**Why it matters**: Instead of searching broadly, users track specific dream companies and get notified of new openings.

**Effort**: Medium — DB table + settings UI + scan logic.

#### 3. Freshness Indicators & Sorting
**What career-ops does**: Tracks first_seen date, dedup history shows reposting patterns.

**Adaptation**: Add freshness badges in job feed ("Today", "This week", "2 weeks ago", "30+ days"). Default sort by freshness. Flag jobs posted >30 days as potentially stale.

**Why it matters**: Users waste time on stale/ghost postings. Visual freshness helps prioritize.

**Effort**: Small — mostly UI changes to jobs-feed.tsx.

#### 4. Interview Prep UI
**What career-ops does**: Story bank with STAR+R format, company-specific research from Glassdoor/Blind/LeetCode, round-by-round breakdown.

**Adaptation**: Build on existing `interview_prep` DB table. Add:
- Story bank management (CRUD for STAR stories)
- AI-powered company research (using web search or AI analysis of JD)
- Question bank mapped to stories

**Why it matters**: Schema exists but no UI — this is the biggest feature gap we already have infrastructure for.

**Effort**: Large — multiple new components + AI prompts + server actions.

#### 5. Follow-up Cadence Reminders
**What career-ops does**: Rules-based reminders (Applied +7d, Responded +1d, Interview +1d thank-you).

**Adaptation**: Add `follow_up_date` to applications or new `follow_ups` table. Dashboard widget showing overdue follow-ups. Configurable cadence rules.

**Why it matters**: Following up is the #1 thing job seekers forget. Automated reminders significantly improve response rates.

**Effort**: Small-Medium — DB field + dashboard widget + cadence calculation logic.

### Tier 2: Medium Impact, Worth Doing

#### 6. Improved Deduplication (Fuzzy Matching)
**What career-ops does**: Normalizes company names, extracts role keywords, checks ≥2 keyword overlap + ≥60% coverage ratio.

**Adaptation**: Enhance `jobs/search/route.ts` dedup beyond URL matching. Fuzzy match on normalized `title + company` to catch same job across different sources.

**Effort**: Small — utility function + integration in search route.

#### 7. Application Analytics / Funnel
**What career-ops does**: `analyze-patterns.mjs` computes funnel (Saved → Applied → Interview → Offer), conversion rates by role type, recommendations.

**Adaptation**: Dashboard analytics page with charts showing application funnel, success rates by company size/role type, time-in-stage metrics.

**Effort**: Medium — new dashboard page + data aggregation queries.

#### 8. Title Filtering (Positive/Negative Keywords)
**What career-ops does**: Config with `positive` and `negative` keyword arrays. Jobs must match ≥1 positive AND 0 negatives.

**Adaptation**: Add to user preferences. Apply server-side before returning results.

**Why**: Reduces noise — user searching "engineer" doesn't want "Sales Engineer" or "Support Engineer".

**Effort**: Small — preferences field + filter logic in search route.

#### 9. ATS PDF Improvements (Unicode Normalization)
**What career-ops does**: Normalizes em-dashes, smart quotes, zero-width chars, non-breaking spaces before PDF generation.

**Adaptation**: Add normalization step in `create-pdf-route.ts` before Playwright renders.

**Effort**: Small — ~20 lines of normalization code.

### Tier 3: Nice to Have, Future Consideration

#### 10. Ghost Job Detection Signals
**What career-ops does**: Block G assessment — posting age, description quality, hiring signals, repost patterns.

**Adaptation**: AI-assisted legitimacy scoring during job save. Flag suspicious postings.

**Effort**: Large — needs AI prompt + scoring UI + additional data collection.

#### 11. Negotiation/Comp Research
**What career-ops does**: Geographic discount pushback scripts, competing offer templates, equity analysis.

**Adaptation**: Add to offer tracking workflow (when status = "Offer").

**Effort**: Large — feature scope is broad.

---

## Architecture Notes

### What WON'T work to adapt:
- **Playwright direct crawling** — Can't run headless browser from a Vercel-deployed Next.js app. ATS APIs are the right approach instead.
- **Claude CLI batch processing** — Different paradigm. Our AI runs through API calls in server actions.
- **Go TUI dashboard** — We have a web UI which is better for our use case.
- **Markdown/TSV data files** — We use PostgreSQL + Drizzle ORM.
- **WebSearch for company intel** — Would need a search API (Serper, Tavily, etc.) which adds cost/complexity.

### What maps cleanly:
- **ATS APIs** → New source files in `src/lib/jobs/`
- **portals.yml** → `tracked_companies` DB table
- **Title filtering** → User preferences
- **Freshness/dedup** → Search route + UI improvements
- **Interview prep** → Existing schema + new UI components
- **Follow-up cadence** → Application status workflow enhancement
- **Analytics** → New dashboard page with SQL aggregations

---

## Greenhouse API Quick Reference

```
GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs
Response: { jobs: [{ id, title, absolute_url, location: { name }, updated_at }] }

GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{job_id}
Response: { id, title, content (HTML), location, departments, offices }
```

No auth required. Rate limit is generous (~100 req/min). EU variant: `boards-api.eu.greenhouse.io`.

## Lever API Quick Reference

```
GET https://api.lever.co/v0/postings/{company}
Response: [{ id, text (title), hostedUrl, categories: { location, team, department }, createdAt }]
```

No auth required.

## Ashby API Quick Reference

```
POST https://jobs.ashbyhq.com/api/non-user-graphql
Body: { operationName: "ApiJobBoardWithTeams", variables: { organizationHostedJobsPageName: "{company}" } }
Response: { data: { jobBoard: { teams: [{ jobs: [{ id, title, locationName, employmentType }] }] } } }
```

No auth required.
