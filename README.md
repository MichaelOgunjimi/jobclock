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
2. Run the migration SQL in `supabase/migrations/001_initial_schema.sql`
3. Copy `.env.local.example` to `.env.local` and fill in your credentials

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

## Phase 1 Status

- [x] Project scaffold (Next.js 15, TypeScript, Tailwind v4, shadcn/ui)
- [x] Supabase schema (all tables from PRD)
- [x] CV upload flow (PDF/DOCX parsing, Supabase Storage)
- [x] Profile page (view/edit parsed CV data)
- [x] Job search UI with Adzuna integration (mock data ready)
- [ ] Phase 2: AI CV customization + cover letter generation
