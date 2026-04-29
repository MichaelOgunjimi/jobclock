# JobClock

**AI-powered job application assistant for UK job seekers.**

Aggregate jobs from multiple sources, tailor your CV and cover letter with AI for every application, track your pipeline from saved to offer, and prep for interviews — all in one place.

> Self-hostable · Bring your own AI key · Open source

---

## Features

- **Multi-source job search** — Adzuna, Reed, and CareerJet APIs queried in parallel with deduplication and seniority-normalised ranking
- **AI CV tailoring** — 4-stage LLM pipeline (JD analysis → keyword gap → rewrite plan → generation) with ATS match scoring (0–100) and PDF export
- **AI cover letter generation** — Context-aware letters generated from your CV, the job description, and your writing style preferences
- **Interview preparation** — AI-generated STAR question banks, company research via Perplexity/Claude, and a "Grill Me" answer evaluation mode
- **Application pipeline** — Kanban-style tracker (saved → applied → screening → interview → offer) with notes, tags, and analytics
- **Chrome extension** — Manifest V3 extension to save any job from any board directly into your pipeline
- **7 CV templates** — Classic, modern, bold, compact, minimal, professional, sidebar — all renderable as PDF
- **Security** — AES-256-GCM encryption for API keys, RLS on every table, SHA-256-hashed personal tokens for extension auth

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| ORM | Drizzle ORM |
| AI | Anthropic Claude / OpenAI (user-configurable) |
| Validation | Zod v4 |
| Rate limiting | Upstash Redis (3 independent sliding-window limiters) |
| Background jobs | Upstash QStash |
| PDF generation | Puppeteer + @sparticuz/chromium (Vercel Lambda) |
| Testing | Vitest (unit/integration), Playwright (E2E) |

---

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- At least one AI API key — [Anthropic](https://console.anthropic.com) or [OpenAI](https://platform.openai.com)
- (Optional) [Adzuna API](https://developer.adzuna.com) keys for live job search

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/MichaelOgunjimi/jobclock.git
cd jobclock
npm install
```

### 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in the required values (see [Environment Variables](#environment-variables) below).

### 3. Set up the database

```bash
# Apply Drizzle-managed schema
npm run db:migrate
```

Then run `supabase/sql/platform-setup.sql` in the Supabase SQL editor to apply RLS policies, auth triggers, and storage bucket configuration.

> **Note**: Do not use `supabase/migrations/001_initial_schema.sql` for a fresh setup — that file is legacy and conflicts with the Drizzle schema.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `DATABASE_URL` | ✅ | Supabase transaction pooler URL (port 6543) |
| `DATABASE_DIRECT_URL` | ✅ | Supabase direct connection URL (port 5432, Drizzle migrations only) |
| `ENCRYPTION_SECRET` | ✅ | 32-byte hex string for AES-256-GCM key encryption |
| `ADZUNA_APP_ID` | ➖ | Adzuna API app ID (job search) |
| `ADZUNA_APP_KEY` | ➖ | Adzuna API key |
| `UPSTASH_REDIS_REST_URL` | ➖ | Upstash Redis URL (rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | ➖ | Upstash Redis token |
| `QSTASH_TOKEN` | ➖ | Upstash QStash token (background jobs) |
| `QSTASH_CURRENT_SIGNING_KEY` | ➖ | QStash receiver verification |
| `QSTASH_NEXT_SIGNING_KEY` | ➖ | QStash receiver verification |

AI keys (Anthropic/OpenAI) and Reed API key are stored per-user in the Settings page, encrypted with `ENCRYPTION_SECRET`.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run test` | Run unit/integration tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |
| `npm run db:generate` | Generate Drizzle migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:studio` | Open Drizzle Studio (DB browser) |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/                     # Login / signup
│   ├── (dashboard)/                # Protected routes
│   │   ├── page.tsx                # Dashboard home + metrics
│   │   ├── jobs/                   # Multi-source job search
│   │   ├── applications/           # Pipeline list + filter/sort
│   │   │   └── [id]/               # Application detail
│   │   │       ├── cv/             # CV tailoring + PDF export
│   │   │       ├── cover-letter/   # Cover letter preview + download
│   │   │       └── interview/      # Interview prep + company research
│   │   ├── profile/                # CVs, cover letter templates, preferences
│   │   └── settings/               # AI provider, job sources, documents
│   └── api/                        # HTTP endpoints
│       ├── jobs/search/            # Job aggregation proxy
│       ├── cv/upload/              # CV upload + AI parsing
│       ├── chat/application/       # Streaming AI chat
│       └── applications/[id]/      # CV generation, interview, research
├── components/
│   ├── cv/templates/               # 7 CV templates (React → PDF)
│   └── ui/                         # Shared UI primitives
└── lib/
    ├── ai/                         # Prompts, schemas, CV tailoring pipeline
    ├── db/                         # Drizzle schema + client
    ├── supabase/                   # Supabase clients + database types
    └── crypto.ts                   # AES-256-GCM encryption helpers
```

---

## Database

Drizzle ORM owns the application schema. The workflow is:

1. Edit `src/lib/db/schema.ts`
2. `npm run db:generate` — produces a SQL migration file in `drizzle/`
3. Review the generated SQL
4. `npm run db:migrate` — applies it via `DATABASE_DIRECT_URL`

Supabase SQL (`supabase/sql/platform-setup.sql`) is reserved for platform-specific configuration: RLS policies, auth triggers, storage buckets, and storage policies.

---

## Browser Extension

The Chrome extension lives in the `extension/` directory. It uses Manifest V3 and lets you save any job from any board directly into your JobClock pipeline. Auth is via a personal API token generated in Settings.

See `extension/README.md` for setup and development instructions.

---

## Deployment

The app is optimised for [Vercel](https://vercel.com). PDF generation uses `@sparticuz/chromium` which downloads a compatible Chromium binary at runtime for Vercel Lambda compatibility.

Set all environment variables in your Vercel project settings before deploying.

---

## License

MIT
