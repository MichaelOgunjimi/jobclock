# Job Assistant

AI-powered job application assistant for UK graduate/entry-level roles.

## Features

- **Job Search**: Browse UK jobs via Adzuna API (with mock data for development)
- **CV Upload**: Upload PDF/DOCX CVs, parsed into structured data
- **Application Tracking**: Track saved jobs through to offers
- **AI CV Customization** (Phase 2): AI-tailored CVs per job application
- **Cover Letter Generation** (Phase 2): AI-generated personalized cover letters

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4, shadcn/ui
- **Backend**: Supabase (Auth, Database, Storage)
- **Job Search**: Adzuna API (mock data mode available)

## Getting Started

### 1. Clone and Install

```bash
npm install
```

### 2. Set Up Supabase

1. Create a project at supabase.com
2. Copy `.env.local.example` to `.env.local` and fill in your credentials
3. Run `npm run db:migrate` to apply the Drizzle-managed schema
4. Run `supabase/sql/platform-setup.sql` in the Supabase SQL editor to apply Supabase-specific setup (RLS, auth trigger, storage buckets/policies)

Do not use `supabase/migrations/001_initial_schema.sql` for a fresh Drizzle-managed database. That file is part of the older Supabase-first setup and overlaps with the Drizzle table creation.

### 3. (Optional) Adzuna API

For live job search data, get free API keys at developer.adzuna.com.
Without these, the app runs on mock data (good for development).

### 4. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

## Project Structure

```
src/
├── app/
│   ├── (auth)/auth/        # Auth page
│   ├── (dashboard)/        # Protected dashboard routes
│   │   ├── page.tsx        # Dashboard home
│   │   ├── jobs/           # Job search
│   │   ├── applications/   # Application tracking
│   │   └── profile/         # CV management
│   ├── api/
│   │   ├── cv/upload/      # CV upload endpoint
│   │   └── jobs/search/    # Job search proxy
│   └── layout.tsx
├── components/
│   ├── app-sidebar.tsx     # Navigation sidebar
│   ├── cv-uploader.tsx     # CV upload component
│   └── ui/                 # shadcn/ui components
└── lib/
    ├── supabase/           # Supabase client + types
    ├── jobs/               # Job search (Adzuna + types)
    └── cv-parser.ts        # CV text parser
```

## Development Status

### Phase A-D ✅ Complete
- [x] Project scaffold (Next.js 15, TypeScript, Tailwind v4, shadcn/ui)
- [x] Database schema (Drizzle-managed tables plus Supabase platform setup)
- [x] CV upload flow (PDF/DOCX parsing, Supabase Storage)
- [x] Profile management (view/edit parsed CV data, cover letter templates)
- [x] Job search UI with multi-source integration (Adzuna, Reed, CareerJet)
- [x] Application tracking and status management

### Phase E 🔄 In Progress
- [x] Application detail pages with status tracking
- [x] AI chat assistant with job and CV context
- [x] CV tailoring with AI (generate button → HTML preview → PDF download)
- [ ] Cover letter generation with AI
- [ ] Skills gap analysis visualization
- [ ] Interview preparation features

### Future Phases
- **Phase F**: Auto-apply automation with Playwright
- **Phase G**: Browser extension for one-click job saving
- **Phase H**: Commercial SaaS infrastructure and billing

## Documentation

- **[API Reference](docs/API.md)** — Complete HTTP endpoint documentation
- **[Architecture Guide](docs/ARCHITECTURE.md)** — System design, data flow, and technical decisions
- **[Database Workflow](docs/database-workflow.md)** — Drizzle ORM setup, migration guide, and schema management

## Database Workflow

- Drizzle is the primary owner of application schema: edit [src/lib/db/schema.ts](src/lib/db/schema.ts), then run `npm run db:generate` and `npm run db:migrate`
- Supabase SQL is reserved for platform-specific setup: RLS, auth triggers, storage buckets, storage policies, and auth-related foreign keys
- The legacy files in `supabase/migrations/` are historical reference from the earlier Supabase-first setup and should not be used to initialize a fresh Drizzle-managed database

See [docs/database-workflow.md](docs/database-workflow.md) for the full migration strategy.
