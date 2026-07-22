# JobClock

<p align="center">
  <img src="public/logo-lockup.svg" alt="JobClock" width="360" />
</p>

<p align="center">
  An AI-assisted job search workspace for discovering roles, managing applications,
  tailoring documents, and preparing for interviews.
</p>

<p align="center">
  <a href="https://jobclock.michaelogunjimi.com">Open JobClock</a>
  ·
  <a href="https://chromewebstore.google.com/detail/jobclock-job-application/albhohoocdlhefihfhiapcmckopbgjhh">Install the Chrome extension</a>
  ·
  <a href="https://jobclock.michaelogunjimi.com/extension/support">Extension support</a>
</p>

## What JobClock does

JobClock brings the job-search workflow into one account:

1. Find roles from supported job sources or capture a listing from any normal
   job page with the Chrome extension.
2. Save and organise applications in a searchable list or visual pipeline.
3. Tailor a CV and cover letter to the job description with a chosen AI
   provider.
4. Research the company and generate structured interview preparation.
5. Track progress from saved through applied, screening, interview, offer, and
   final outcomes.

The hosted application is built for UK job seekers, including UK-focused
location, salary, experience-level, and right-to-work preferences.

## Features

### Job discovery and capture

- Search Adzuna, Reed, and CareerJet with source-aware filtering and result
  deduplication.
- Configure desired roles, UK locations, salary range, experience level, and
  job sources.
- Track companies and synchronise their open roles.
- Import a job directly from its URL.
- Capture the active listing with the published
  [JobClock Chrome extension](https://chromewebstore.google.com/detail/jobclock-job-application/albhohoocdlhefihfhiapcmckopbgjhh).

### Application workspace

- Manage applications in list and pipeline views.
- Track saved, applied, screening, interview, offer, ghosted, rejected, and
  withdrawn outcomes.
- Keep job details, notes, documents, preparation, and status history together.
- Review pipeline analytics and application activity.

### AI-assisted documents

- Analyse job descriptions and identify relevant requirements and keywords.
- Tailor CV content and calculate an ATS-oriented match score.
- Generate role-specific cover letters from the saved job and profile context.
- Preview and export generated documents as PDFs.
- Choose from seven CV layouts: classic, modern, bold, compact, minimal,
  professional, and sidebar.
- Use OpenAI or Anthropic with a personal encrypted API key.

### Interview preparation

- Generate role-specific interview questions and suggested answer structures.
- Build STAR-focused preparation from the application and profile.
- Research companies with supported web-search providers.
- Practise answers and receive structured AI feedback.

### Security and privacy

- Encrypt saved provider credentials with AES-256-GCM.
- Hash personal extension tokens with SHA-256 before persistence.
- Apply PostgreSQL Row Level Security to account data.
- Restrict the extension to user-triggered active-tab access and the production
  JobClock host.
- Let users revoke extension access from Settings at any time.

## Chrome extension

The Manifest V3 extension is publicly available in the
[Chrome Web Store](https://chromewebstore.google.com/detail/jobclock-job-application/albhohoocdlhefihfhiapcmckopbgjhh).
It previews the active job page and saves the confirmed listing to the user's
JobClock pipeline.

### Connect the extension

1. Sign in at [jobclock.michaelogunjimi.com](https://jobclock.michaelogunjimi.com).
2. Install
   [JobClock: Job Application Tracker](https://chromewebstore.google.com/detail/jobclock-job-application/albhohoocdlhefihfhiapcmckopbgjhh).
3. Open **Settings → Extension** in JobClock.
4. Generate a personal extension token and copy it when it appears. The full
   token is shown only once.
5. Open the extension, paste the token, and select **Connect JobClock**.
6. Open a job listing, review the extracted preview, and select **Save to
   JobClock**.

If a token expires or is revoked, generate a new one in Settings and reconnect
the extension. Never send an extension token in a support request.

See the [extension guide](extension/README.md),
[support page](https://jobclock.michaelogunjimi.com/extension/support), and
[extension privacy policy](https://jobclock.michaelogunjimi.com/extension/privacy)
for more detail.

## Technology

| Area | Technology |
| --- | --- |
| Web application | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4, Base UI, shadcn components |
| Database and authentication | Supabase PostgreSQL, Auth, Storage, Row Level Security |
| Schema and migrations | Drizzle ORM and Drizzle Kit |
| AI | OpenAI and Anthropic; Perplexity for supported research flows |
| Validation | Zod 4 |
| Rate limiting and jobs | Upstash Redis and QStash |
| PDF rendering | Puppeteer Core and `@sparticuz/chromium` |
| Browser extension | Chrome Manifest V3 |
| Testing | Vitest, Testing Library, Playwright |
| Hosting | Vercel |

## Local development

### Requirements

- Node.js 20 or newer
- npm
- A Supabase project
- PostgreSQL connection strings for the Supabase database
- At least one OpenAI or Anthropic API key for AI features
- Optional job-source credentials for live search

### 1. Clone and install

```bash
git clone https://github.com/MichaelOgunjimi/jobclock.git
cd jobclock
npm install
```

### 2. Configure the environment

```bash
cp .env.local.example .env.local
```

Set the core values in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public anonymous key |
| `DATABASE_URL` | PostgreSQL connection used by the application and Drizzle |
| `DATABASE_DIRECT_URL` | Optional direct connection preferred by `npm run db:migrate` |
| `ENCRYPTION_SECRET` | 32-byte hexadecimal key used to encrypt saved credentials |
| `NEXT_PUBLIC_APP_URL` | Public application origin; use `http://localhost:3000` locally |

Generate an encryption secret with:

```bash
openssl rand -hex 32
```

Optional integrations:

| Variable | Integration |
| --- | --- |
| `OPENAI_API_KEY` | Platform OpenAI key for authorised accounts |
| `ANTHROPIC_API_KEY` | Platform Anthropic key for authorised accounts |
| `PERPLEXITY_API_KEY` | Company research fallback |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Adzuna job search |
| `CAREERJET_API_KEY` | CareerJet job search |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Distributed rate limiting |
| `QSTASH_TOKEN` | Background generation and scheduled work |
| `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | QStash request verification |
| `CRON_SECRET` | Direct cron request authentication |
| `BEACO_API_URL`, `BEACO_API_KEY` | Optional Beaco event delivery |

Users can save their own OpenAI, Anthropic, Perplexity, and Reed credentials in
Settings. Those values are encrypted before storage and are not public browser
environment variables.

### 3. Prepare the database

Apply the Drizzle-managed schema:

```bash
npm run db:migrate
```

Then run [`supabase/sql/platform-setup.sql`](supabase/sql/platform-setup.sql) in
the Supabase SQL editor to configure Row Level Security, authentication hooks,
and storage policies.

Do not apply files under `supabase/legacy-migrations/` to a fresh database.
They are retained only as historical migrations and conflict with the current
Drizzle-owned schema.

### 4. Run JobClock

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest unit and integration suite |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Build the app and run Playwright end-to-end tests |
| `npm run db:generate` | Generate a migration from the Drizzle schema |
| `npm run db:migrate` | Apply pending database migrations |
| `npm run db:push` | Push the current schema directly to the database |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run extension:assets` | Render Chrome Web Store artwork |
| `npm run extension:validate` | Validate the extension release without packaging it |
| `npm run extension:package` | Validate and create the uploadable extension ZIP |

## Repository structure

```text
src/
├── app/
│   ├── (auth)/                 Authentication pages and callbacks
│   ├── (dashboard)/            Protected product routes
│   │   ├── applications/       Application list, pipeline, and detail flows
│   │   ├── interview/          Standalone interview practice
│   │   ├── jobs/               Multi-source job discovery
│   │   ├── profile/            CVs, templates, and job-seeker context
│   │   └── settings/           AI, sources, extension, and account settings
│   ├── api/                    Application, AI, search, import, and cron APIs
│   └── extension/              Public extension support and privacy pages
├── components/                 Product and shared UI components
└── lib/
    ├── ai/                     Provider selection and generation utilities
    ├── db/                     Drizzle schema and database access
    ├── generation/             Background generation dispatch
    ├── jobs/                   Search, extraction, and persistence logic
    └── supabase/               Browser and server Supabase clients

drizzle/migrations/             Current application database migrations
extension/                      Manifest V3 extension source and store assets
scripts/                        Migration, packaging, and release utilities
supabase/sql/                   Supabase platform configuration
tests/                          Playwright end-to-end tests
```

## Database workflow

Drizzle owns the application schema:

1. Update `src/lib/db/schema.ts`.
2. Run `npm run db:generate`.
3. Review the generated SQL under `drizzle/migrations/`.
4. Run `npm run db:migrate`.
5. Run the relevant tests before committing the schema change.

Use `supabase/sql/platform-setup.sql` only for Supabase-specific platform
configuration such as policies, authentication hooks, and storage setup.

## Deployment

The production application runs on Vercel. Before deploying:

1. Configure the core environment variables for the target environment.
2. Add only the optional provider and infrastructure credentials the deployment
   will use.
3. Apply all pending Drizzle migrations.
4. Apply the Supabase platform SQL when provisioning a new project.
5. Run `npm run lint`, `npm test`, and `npm run build`.

PDF generation uses `@sparticuz/chromium` in serverless environments. QStash is
optional during local development; without it, supported generation work falls
back to the inline development path.

## Public policies and support

- [General privacy policy](https://jobclock.michaelogunjimi.com/privacy)
- [Terms of service](https://jobclock.michaelogunjimi.com/terms)
- [Cookie policy](https://jobclock.michaelogunjimi.com/cookies)
- [Extension privacy policy](https://jobclock.michaelogunjimi.com/extension/privacy)
- [Extension support](https://jobclock.michaelogunjimi.com/extension/support)
- Support: [support@jobclock.michaelogunjimi.com](mailto:support@jobclock.michaelogunjimi.com)

## Contributing

Use the repository's existing conventions, keep changes focused, and include
tests for behaviour changes. Before opening a pull request, run:

```bash
npm run lint
npm test
npm run build
```

Issues and pull requests are managed in
[MichaelOgunjimi/jobclock](https://github.com/MichaelOgunjimi/jobclock).
