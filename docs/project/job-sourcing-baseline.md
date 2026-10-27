# Job sourcing: baseline and direction

Written 2026-10-23, at the end of the billing work, as the starting point for the next big theme. Numbers come from the hosted dev database (4 users, so small and indicative, not statistical) and from the code. Re-run the queries at the bottom to refresh them.

## Why this is next
The owner's view: the main problem for the app now is getting good job postings. Today he finds and imports jobs with the Chrome extension from other sites; the goal is to do search and import inside JobClock so the extension is optional, with every other feature (matching, autofill, company pages) built on top. Better sourcing is also what could justify higher-priced plans.

**Target market: UK and global.** Search must work worldwide, not only for UK roles. (Paid-plan territory is a separate, still open tax question; see the billing spec.)

## What exists today
| Route | What it does | Limits |
| --- | --- | --- |
| Reed | In-app search API | UK only (`reed.co.uk`) |
| Adzuna | In-app search API | Hardcoded to `/jobs/gb/` |
| Careerjet | In-app search API | Hardcoded `locale_code=en_GB` |
| Greenhouse, Lever, Ashby, Workday | Employer job-board syncs for preset companies (about 83 presets in code, 103 companies seen in the cache) | Only companies on the preset list; Workday is small |
| Import by URL or pasted text | `import-job` with LLM extraction (1 credit) | One job at a time |
| Chrome extension | Captures jobs from pages the user is logged into (LinkedIn, Totaljobs, Welcome to the Jungle, Gradcracker) | Needs the extension and a manual visit |
| Telegram digest | Daily summary | Delivers what is already cached |
| Crons | `sync-presets` daily at 03:00 is in `vercel.json`; `sync-companies`, `sync-company`, `prune-jobs`, `telegram-digest` routes exist | Verify what actually schedules the others (possibly QStash, see `scripts/setup-qstash-schedules.ts`) |

## What the data shows
**Where users' jobs come from.** Of 293 tracked applications, 274 have no search source (extension, pasted link, manual entry) and only 19 came from in-app search (Reed 10, Adzuna 9). People are not finding jobs through in-app search; they find them elsewhere and import.

**The cache is employer-board jobs for a few hundred companies.** 12,972 postings; about 87% from Greenhouse (7,276), Ashby (3,957) and Lever (1,392). The search APIs contribute only 12 to 43 postings each because they are cached on demand, so those counts say nothing about their real coverage.

**Quality gaps by source** (percent of postings missing the field):

| Source | Postings | No posted date | No salary |
| --- | --- | --- | --- |
| Greenhouse | 7,276 | 0% | ~100% |
| Ashby | 3,957 | **100%** | ~100% |
| Lever | 1,392 | 0% | ~100% |
| LinkedIn (via extension) | 130 | **99%** | 32% |
| Adzuna | 43 | 0% | 0% |
| Workday | 23 | 65% | 91% |

- **Salary:** employer-board postings almost never carry it (4 of 7,276 on Greenhouse). Aggregator and extension imports are far better.
- **Freshness:** 9,418 of 12,972 postings (73%) were not seen in the last 7 days, and 8,206 were last scraped over 30 days ago. Pruning removes only old, unsaved jobs.
- **Geography:** of the postings, about 2,400 look UK-based and about 4,200 look US-based by location text; the rest are unclear. The ATS syncs are global, but the three search APIs are UK-only, so "global search" has no real source today.
- **Companies and recruiters:** nothing exists yet. See the staged idea below.

## Competitor reference: Jobright
Public, unverified claims: listings from "leading boards, company career sites, and public listings" (LinkedIn, Indeed, ZipRecruiter named in a 2024 press release); about 8 million active listings, 400,000+ added daily, refreshed every few minutes; US-only; per-job match score; a Chrome extension that autofills applications; reviewers report its resume AI sometimes invents details. Their pipeline is probably employer ATS boards, career-page crawling with LLM extraction, aggregator feeds, de-duplication and per-user ranking, plus user capture. Copy the pipeline, not the volume.

## Direction (hypotheses to confirm in the spec session)
1. **Breadth:** one wide, paid aggregator feed with global coverage (the Google-for-Jobs-style listings), and make Adzuna and Careerjet country-aware instead of UK-hardcoded.
2. **Employer boards:** more ATS types (Workable, SmartRecruiters, Workday depth) and a much larger company list, with refresh that actually keeps postings current.
3. **Field quality:** an LLM or rules step to fill posted date, salary, seniority and location, applied only to postings a user opens or that pass a cheap filter, to keep cost bounded.
4. **De-duplication** across sources.
5. **Relevance:** a per-user match score from CV and preferences, plus saved searches with alerts. This is the natural Pro or higher-tier feature.
6. **Import everywhere:** paste any link or text, one click from the jobs page; the extension becomes optional.
7. **Later: companies and recruiters.** Claimable company pages first, then direct posting and recruiter tools, only once seekers and jobs are flowing (cold start, fake-job moderation and recruiter data-protection issues make it a poor first step).

## Open questions
- Which wide aggregator, and what it costs per search or per month against a plan price.
- How freshness is measured and refreshed without a high crawl cost.
- Which sites the owner imports from most today, to prioritise coverage.
- Whether match scoring uses AI credits or is free.

## Re-running the numbers
```sql
-- postings, missing fields and freshness by source
select source, count(*) n,
  round(100.0*count(*) filter (where posted_at is null)/count(*)) pct_no_posted_at,
  round(100.0*count(*) filter (where salary_min is not null)/count(*)) pct_salary
from jobs_cache group by 1 order by 2 desc;
select count(*) filter (where last_seen_at < now()-interval '7 days') stale_7d,
       count(*) filter (where scraped_at < now()-interval '30 days') scraped_30d_ago from jobs_cache;
-- where tracked applications come from
select source, count(*) from applications group by 1 order by 2 desc;
```
