# OpenPostings → Job-Assistant: Feature Analysis & Adaptation Plan

## What is OpenPostings?

An open-source ATS job aggregator and application tracker. It scrapes/fetches job postings from **20+ ATS platforms** across **~10,500 pre-indexed companies** into a local SQLite database. Features AI agent integration via Model Context Protocol (MCP) for automated job applications.

**Tech stack**: React Native + Expo (frontend), Express + SQLite (backend), MCP SDK (AI agent).

---

## Feature Comparison

| Feature | OpenPostings | Job-Assistant | Gap |
|---------|-------------|---------------|-----|
| **ATS Sources** | 20+ (Workday, Greenhouse, Lever, Ashby, iCIMS, Taleo, Jobvite, etc.) | 3 aggregator APIs (Adzuna, Reed, Careerjet) | Major — no direct ATS scraping |
| **Company Database** | ~10,500 pre-indexed companies | None | Major — no company catalog |
| **Job TTL** | 24h auto-expiry (last_seen_epoch) | No expiry — jobs cached indefinitely | Medium |
| **ATS Detection** | Auto-detect from URL pattern | None | Medium — useful for adding companies |
| **Industry Classification** | ML n-gram matching (job title → industry) | None | Medium — useful for filtering |
| **Rate Limiting** | Per-ATS concurrency slots (1-20), queue-based | None on job search | Medium |
| **AI Agent** | MCP protocol — LLMs can browse and apply to jobs | AI for CV tailoring only | Large — different paradigm |
| **Application Tracking** | 6-state workflow + AI attribution | Status tracking exists | Small overlap |
| **Deduplication** | URL-based | URL-based (same approach) | Parity |
| **Remote Detection** | Parses title/location for remote indicators | Not implemented | Small |
| **Multi-platform** | React Native (Web + Android + Windows) | Next.js (Web only) | N/A |

---

## What to Adapt (Prioritized)

### High Impact

#### 1. Additional ATS Parsers (Workday, iCIMS, Jobvite, TeamTailor)
OpenPostings has parsers for 20+ ATS platforms. Beyond the Greenhouse/Lever/Ashby we planned from career-ops, the most valuable additions:
- **Workday** — Used by large enterprises (Microsoft, Amazon, Netflix). Shard-based API.
- **TeamTailor** — RSS feed support, common in UK/EU companies.
- **Jobvite** — Common in mid-market companies.
- **iCIMS** — Used by large employers (Target, UPS, Hilton).

#### 2. Company Seed Database
OpenPostings has ~10,500 companies with their ATS type and URL. We could:
- Extract this as a seed/lookup for tracked companies
- Let users search from this catalog instead of manually entering slugs
- Auto-suggest companies when user types in settings

#### 3. URL-Based ATS Detection
Auto-detect which ATS a company uses from their careers page URL:
- `*.myworkdayjobs.com` → Workday
- `jobs.lever.co/*` → Lever
- `boards.greenhouse.io/*` → Greenhouse
- `jobs.ashbyhq.com/*` → Ashby
- `*.teamtailor.com` → TeamTailor

User pastes a careers URL → system auto-detects ATS type + extracts slug.

#### 4. Job TTL / Freshness Expiry
OpenPostings expires jobs after 24h if not re-seen. For job-assistant:
- Mark jobs as "stale" after configurable period (7-30 days)
- Auto-hide or deprioritize stale jobs in search results
- Show "Last verified: X days ago" indicator

### Medium Impact

#### 5. Industry Classification
ML n-gram matching on job titles to categorize by industry (IT, Sales, Finance, etc.). Enables better filtering beyond keyword search.

#### 6. Remote Work Detection
Parse job title and location for remote indicators: "remote", "hybrid", "work from home", "WFH". Add as a filter in search.

#### 7. Rate Limiting for ATS Requests
Per-ATS concurrency control with queue-based slots. Important as users add more tracked companies.

### Future Consideration

#### 8. MCP Protocol Integration
Let AI agents (Claude, etc.) autonomously search, evaluate, and apply to jobs. Complex but innovative.

---

## ATS Parser Reference (from OpenPostings)

### Workday
```
URL pattern: *.myworkdayjobs.com/en-US/{company}/jobs
API: POST with search/sort/offset parameters
Returns: { total, jobPostings: [{ title, bulletFields, externalPath, postedOn }] }
```

### TeamTailor
```
URL pattern: {company}.teamtailor.com or career.{company}.com
RSS: {base}/feed.xml
Returns: RSS items with title, link, pubDate
```

### iCIMS
```
URL pattern: careers-{company}.icims.com
API: /jobs/search with pageSize/offset
Returns: { jobs: [{ title, url, location }] }
```

### Jobvite
```
URL pattern: jobs.jobvite.com/{company}
API: /json with page parameter
Returns: { postings: [{ title, detailUrl, location }] }
```

---

## Key Differences from Career-Ops

| Aspect | Career-Ops | OpenPostings |
|--------|-----------|--------------|
| **Scale** | 45 tracked companies | 10,500 companies |
| **Approach** | Quality-focused (evaluate before apply) | Volume-focused (aggregate everything) |
| **AI Use** | Claude CLI for evaluation | MCP for autonomous applying |
| **Data** | Markdown/YAML/TSV files | SQLite database |
| **Freshness** | Scan history + dedup | 24h TTL auto-expiry |
| **ATS Count** | 5 (Greenhouse, Lever, Ashby, BambooHR, Workday) | 20+ platforms |
| **CV Tailoring** | Keyword injection + archetype | Not included |
| **Interview Prep** | STAR+R story bank | Not included |

**Bottom line**: Career-ops excels at quality (evaluation, CV tailoring, interview prep). OpenPostings excels at scale (10,500 companies, 20+ ATS parsers, auto-expiry). Our plan should combine the best of both.
