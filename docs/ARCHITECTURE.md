# Job Assistant (Jobclock) — Architecture Guide

> **Status**: Active Development  
> **Last Updated**: 2025-01-27  
> **Version**: Next.js 16, React 19, TypeScript

A comprehensive architecture guide for the AI-powered job application assistant targeting UK graduate/entry-level roles. This document covers the complete system design, data flows, and technical patterns for developers joining the project.

---

## 1. Project Overview

### What Jobclock Does
An intelligent job application assistant that helps users:
- **Discover** relevant jobs across multiple UK sources (Adzuna, Reed, CareerJet)
- **Tailor** CVs with AI per application for maximum relevance
- **Generate** personalized cover letters with context-aware AI
- **Track** applications through the entire lifecycle (saved → applied → interview → offer)
- **Optimize** applications with ATS scoring and skills gap analysis

### Target Users
- UK graduates seeking entry-level positions
- Junior professionals advancing their careers
- Job seekers wanting to automate CV customization

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 16.2.1 (App Router) | React 19, TypeScript, SSR/SSG |
| **Styling** | Tailwind CSS v4 | Utility-first styling with design tokens |
| **UI Components** | @base-ui/react v1.3.0 | Headless accessibility primitives |
| **Database** | Supabase PostgreSQL | Auth + Database + Storage unified |
| **ORM** | Drizzle ORM | Type-safe schema management and migrations |
| **AI Providers** | Anthropic Claude / OpenAI | User-configurable AI assistance |
| **Validation** | Zod v4 | Runtime type validation, AI response parsing |
| **External APIs** | Adzuna, Reed, CareerJet | UK job data aggregation |
| **Rate Limiting** | Upstash Redis | API protection and abuse prevention |
| **PDF Generation** | Puppeteer | HTML→PDF for documents |
| **File Processing** | pdf-parse, mammoth.js | CV text extraction from uploads |
| **Storage** | Supabase Storage | User files (CVs, templates) with RLS |

---

## 2. Directory Structure

```
src/
├── app/                           # Next.js App Router
│   ├── (auth)/auth/               # Auth pages (login/signup)
│   ├── (dashboard)/               # Protected application routes
│   │   ├── layout.tsx             # Dashboard shell with sidebar navigation
│   │   ├── page.tsx               # Dashboard home with application metrics
│   │   ├── jobs/                  # Job discovery and search
│   │   │   ├── page.tsx           # Multi-source job search interface
│   │   │   └── actions.ts         # Save job to pipeline server actions
│   │   ├── applications/          # Application lifecycle management
│   │   │   ├── page.tsx           # Applications list with filtering
│   │   │   ├── [id]/              # Individual application detail views
│   │   │   │   ├── page.tsx       # Application dashboard with status
│   │   │   │   ├── actions.ts     # Status updates, notes, deletion
│   │   │   │   ├── cv/            # CV tailoring for this application
│   │   │   │   └── cover-letter/  # Cover letter generation
│   │   │   └── actions.ts         # Application CRUD operations
│   │   ├── profile/               # User profile and CV management
│   │   │   ├── page.tsx           # Multi-tab profile editor (CVs/Cover Letters/Preferences)
│   │   │   └── actions.ts         # CV upload, profile updates
│   │   ├── settings/              # Configuration and preferences
│   │   │   ├── page.tsx           # Multi-tab settings (AI/Documents/Job Sources)
│   │   │   └── actions.ts         # Settings persistence and validation
│   │   └── account/               # Account management
│   ├── api/                       # HTTP API endpoints
│   │   ├── jobs/search/           # Job search proxy and aggregation
│   │   ├── cv/upload/             # CV file upload + AI parsing
│   │   ├── chat/application/      # Streaming AI chat with context
│   │   ├── cover-letter/parse/    # Document text extraction utilities
│   │   ├── applications/[id]/     # Application-specific APIs
│   │   │   ├── cv/generate/       # AI CV tailoring (Server-Sent Events)
│   │   │   ├── cv/pdf/            # CV PDF download endpoint
│   │   │   └── cover-letter/pdf/  # Cover letter PDF download
│   │   ├── template/              # Template upload/download management
│   │   └── cron/ping/             # Health check and system monitoring
│   ├── globals.css                # Global styles, CSS variables, design tokens
│   └── layout.tsx                 # Root layout with auth, theming, providers
├── components/                    # Reusable React components
│   ├── ui/                        # Base UI components (buttons, inputs, forms)
│   ├── app-sidebar.tsx            # Main navigation sidebar
│   ├── dashboard-shell.tsx        # Dashboard layout wrapper
│   ├── cv-uploader.tsx            # File upload with progress and validation
│   ├── theme-provider.tsx         # Dark/light mode context
│   └── cv/                        # CV-specific components
│       ├── cv-editor.tsx          # CV editing interface
│       └── cv-preview.tsx         # CV display and preview
├── hooks/                         # Custom React hooks
│   ├── use-auth.ts                # Authentication state management
│   └── use-job-search.ts          # Job search state and filters
├── lib/                           # Core utilities and integrations
│   ├── supabase/                  # Supabase client configuration
│   │   ├── server.ts              # Server-side client with auth handling
│   │   ├── client.ts              # Browser client for client components
│   │   ├── config.ts              # Configuration validation and setup
│   │   └── database.types.ts      # Generated TypeScript types from schema
│   ├── db/                        # Database schema and migrations
│   │   ├── schema.ts              # Drizzle ORM schema definition
│   │   └── index.ts               # Database client and query utilities
│   ├── ai/                        # AI integration and processing
│   │   ├── index.ts               # Provider configuration and selection
│   │   ├── prompts/               # System prompts for different AI tasks
│   │   ├── parse-cv.ts            # CV text→structured JSON parsing
│   │   ├── cv-tailoring-schemas.ts # Zod schemas for CV generation pipeline
│   │   ├── cv-tailoring-types.ts  # TypeScript types for all AI stages
│   │   └── extract-json.ts        # JSON extraction from AI responses
│   ├── jobs/                      # Job source integrations
│   │   ├── adzuna.ts              # Adzuna API integration (primary UK source)
│   │   ├── reed.ts                # Reed API integration (secondary UK source)
│   │   ├── careerjet.ts           # CareerJet API integration
│   │   └── types.ts               # Common job data structures
│   ├── crypto.ts                  # API key encryption (AES-256-GCM)
│   ├── rate-limit.ts              # Redis-based rate limiting utilities
│   ├── utils.ts                   # Common utilities (clsx, date formatting)
│   └── cv-data.ts                 # CV data types and validation schemas
└── test/                          # Test utilities and fixtures
    ├── setup.ts                   # Vitest configuration
    └── fixtures/                  # Mock data for testing
```

---

## 3. Data Flow

### Authentication Flow
```
User Login → Supabase Auth → Server-side session → Middleware validation → Protected routes
```

**Implementation Details**:
1. **Supabase SSR** handles authentication state with server-side cookies
2. **Profile Auto-creation**: Auth trigger creates profile record on signup
3. **Route Protection**: All `/dashboard/*` routes require authentication
4. **Server Actions**: Verify user identity via `createClient().auth.getUser()`
5. **Client-side State**: Auth context provides user data to components

### Job Search Flow
```
User preferences → Multi-source API calls → Experience filtering → Deduplication → Cache → UI display
```

**Step-by-Step Process**:
1. **Query Construction**: User preferences (roles, locations, experience) pre-populate search filters
2. **Source Selection**: Active job sources determined by user settings
   - Adzuna: Always available (free tier: 1k requests/day)
   - Reed: Requires user API key from settings
   - CareerJet: No authentication required
3. **Parallel Fetching**: Multiple APIs called simultaneously for performance
4. **Experience Level Filtering**:
   - **Adzuna**: Uses `what_or` parameter for flexible multi-level matching
   - **CareerJet**: Runs parallel queries per experience level
   - **Reed**: Applies experience filters directly in API call
5. **Deduplication**: Results merged and deduplicated by job URL
6. **Caching**: Jobs stored in `jobs_cache` table for performance
7. **Save Action**: Creates `applications` record when user saves job

### CV Upload & Parsing Flow
```
File upload → Text extraction → AI parsing → Zod validation → JSON storage
```

**Processing Pipeline**:
1. **File Validation**: Check file type (PDF/DOCX), size limits, security headers
2. **Text Extraction**: 
   - PDF files: `pdf-parse` library
   - DOCX files: `mammoth.js` with text extraction
3. **AI Parsing**: Claude/GPT converts unstructured text to structured JSON
4. **Schema Validation**: Zod schemas ensure data consistency
5. **Storage**: Parsed JSON stored in `user_cvs.parsed_json`, original file in Supabase Storage
6. **Primary CV**: User can designate one CV as primary for applications

### CV Tailoring Pipeline (4-Stage AI Process)
```
Job description → B: JD Analysis → C: Match Analysis → D: Tailoring Plan → E: Content Generation
```

**Stage Details** (All streamed via Server-Sent Events):

**Stage B - Job Description Analysis**:
- Extract job requirements, skills, keywords, responsibilities
- Identify seniority level and job family
- Parse must-have vs. nice-to-have requirements
- Output: `JobAnalysis` schema with structured job data

**Stage C - CV-Job Match Analysis**:
- Compare CV against job requirements
- Rank evidence (experience, projects, education) by relevance
- Identify matched/missing/weak keywords
- Calculate relevance scores for each CV section
- Output: `CvMatchAnalysis` with rankings and gaps

**Stage D - Tailoring Strategy**:
- Create optimization plan based on match analysis
- Determine which sections to emphasize/deprioritize
- Plan keyword integration and theme alignment
- Generate ATS optimization strategy
- Output: `TailoringPlan` with specific instructions

**Stage E - Content Generation**:
- Rewrite CV sections according to tailoring plan
- Integrate target keywords naturally
- Optimize for ATS while maintaining readability
- Generate tailored bullets and descriptions
- Output: `TailoredCv` with complete customized content

**Database Updates**:
- Creates `customized_cvs` record with tailored JSON
- Stores `skills_gap` analysis for user review
- Calculates `ats_score` based on keyword matching

### Cover Letter Generation
```
Job + CV context → AI analysis → Template application → Content generation → PDF output
```

**Process Flow**:
1. **Context Assembly**: Combine job description, tailored CV, and user preferences
2. **Template Selection**: User chooses from predefined or custom structures
3. **Tone Configuration**: Professional, enthusiastic, formal, or conversational
4. **AI Generation**: Claude/GPT creates personalized cover letter
5. **Review & Edit**: User can modify generated content
6. **PDF Export**: Convert to formatted PDF for applications

### Chat Assistant Flow
```
User message → Context injection → AI processing → Streaming response → Web search (if needed)
```

**Context-Aware Features**:
- **Application Context**: Current job, CV, and application status
- **Web Search**: Real-time company research and industry insights
- **Conversation Memory**: Maintains context across chat sessions
- **Rate Limiting**: 20 messages per minute per user (Redis-based)

---

## 4. Database Schema

### Core Tables

**profiles** - User account and preferences
```sql
id              uuid PRIMARY KEY
email           text NOT NULL
created_at      timestamptz DEFAULT now()
preferences     jsonb DEFAULT {}              -- AI settings, job source config
right_to_work_uk boolean                     -- Required for UK applications
locations_uk    text[]                       -- Preferred UK cities
desired_roles   text[]                       -- Target job titles
experience_level text[]                      -- ["graduate", "junior", "mid", "senior"]
target_salary_min numeric                    -- Minimum salary filter
cv_template_path text                        -- DOCX template in Supabase Storage
cover_letter_template_path text             -- Cover letter template path
full_name       text
phone           text
linkedin_url    text
github_url      text
portfolio_url   text
avatar_url      text
```

**user_cvs** - Uploaded and parsed CV data
```sql
id                uuid PRIMARY KEY
user_id           uuid NOT NULL REFERENCES profiles(id)
name              text                        -- User-friendly CV name
original_file_path text                       -- Path to original PDF/DOCX
parsed_json       jsonb                       -- Structured CV data
file_path         text                        -- Processed file path
created_at        timestamptz DEFAULT now()
is_primary        boolean DEFAULT false       -- Default CV for applications
```

**jobs_cache** - Aggregated job data from all sources
```sql
id                uuid PRIMARY KEY
url               text UNIQUE NOT NULL        -- Job URL for deduplication
source            text NOT NULL               -- "adzuna" | "reed" | "careerjet"
title             text NOT NULL
company           text NOT NULL
location          text
description       text
salary_min        numeric
salary_max        numeric
salary_currency   text DEFAULT 'GBP'
posted_at         timestamptz
scraped_at        timestamptz DEFAULT now()
is_easy_apply     boolean DEFAULT false
apply_deadline    date
```

**applications** - User application tracking
```sql
id                    uuid PRIMARY KEY
user_id               uuid NOT NULL REFERENCES profiles(id)
job_id                uuid REFERENCES jobs_cache(id)
status                application_status DEFAULT 'saved'  -- Enum
applied_at            timestamptz
cover_letter_id       uuid REFERENCES cover_letters(id)
customized_cv_id      uuid REFERENCES customized_cvs(id)
structure_id          uuid REFERENCES cover_letter_structures(id)
cover_letter_tone     text
source                text
notes                 text
tags                  text[]
created_at            timestamptz DEFAULT now()
last_status_update    timestamptz DEFAULT now()
auto_apply_attempted  boolean DEFAULT false
auto_apply_success    boolean
application_quality_score integer
right_to_work_confirmed boolean DEFAULT false
custom_description    text                   -- User-edited job description
```

**customized_cvs** - AI-tailored CV versions
```sql
id                uuid PRIMARY KEY
user_id           uuid NOT NULL REFERENCES profiles(id)
application_id    uuid REFERENCES applications(id)
cv_json           jsonb                      -- Tailored CV content
pdf_path          text                       -- Generated PDF path
ats_score         integer                    -- ATS optimization score
skills_gap        jsonb                      -- Gap analysis data
created_at        timestamptz DEFAULT now()
```

**cover_letters** - Generated cover letters
```sql
id                uuid PRIMARY KEY
user_id           uuid NOT NULL REFERENCES profiles(id)
application_id    uuid REFERENCES applications(id)
content           text NOT NULL
created_at        timestamptz DEFAULT now()
reviewed          boolean DEFAULT false
label             text
tone              text
```

### Row Level Security (RLS)
All tables enforce user isolation through RLS policies:

```sql
-- Example: Users can only access their own applications
CREATE POLICY "Users can view own applications" ON applications 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own applications" ON applications 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own applications" ON applications 
  FOR UPDATE USING (auth.uid() = user_id);
```

### Migration Strategy
- **Drizzle ORM**: Manages application schema changes (`src/lib/db/schema.ts`)
- **Supabase SQL**: Platform-level setup (auth triggers, RLS policies) 
- **Two Connection URLs**:
  - `DATABASE_DIRECT_URL`: Direct connection (port 5432) for migrations
  - `DATABASE_URL`: Transaction pooler (port 6543) for runtime queries

---

## 5. AI Pipeline Details

### AI Provider Resolution
```typescript
// User preference → Environment fallback → Default
const provider = user.preferences.ai_provider || process.env.DEFAULT_AI_PROVIDER || 'anthropic'
const model = user.preferences.ai_model || getDefaultModel(provider)
```

**Supported Providers**:
- **Anthropic Claude**: Sonnet 4.6 (recommended), Haiku 4.5 (fast), Opus 4.6 (premium)
- **OpenAI GPT**: GPT-4o (recommended), GPT-4o-mini (fast), GPT-4-turbo

### Schema Validation Strategy
Uses **defensive Zod schemas** that never crash on malformed AI output:

```typescript
// Coerce any value to string, handle null/undefined gracefully
const coerceStr = z.any()
  .transform((v) => (v == null ? "" : String(v)))
  .default("")

// Transform objects/arrays/primitives to string arrays
const strArray = z.any()
  .transform((v) => {
    if (Array.isArray(v)) return v.map(item => String(item)).filter(Boolean)
    if (v == null) return []
    return [String(v)]
  })
  .default([])
```

**Philosophy**: Accept anything AI returns, transform to expected shape, provide sensible defaults.

### 4-Stage CV Tailoring Pipeline

Each stage has dedicated Zod schemas and TypeScript interfaces:

```typescript
// Stage B: Job Description Analysis
interface JobAnalysis {
  job_family: string
  must_have_keywords: string[]
  responsibilities: string[]
  tools_and_technologies: string[]
  // ... full schema in cv-tailoring-types.ts
}

// Stage C: CV-Job Matching  
interface CvMatchAnalysis {
  matched_keywords: string[]
  missing_keywords: string[]
  evidence_ranking: {
    experience: RankedEvidence[]
    projects: RankedEvidence[]
    // ...
  }
  // ... full schema
}

// Stage D: Tailoring Strategy
interface TailoringPlan {
  instructions: TailoringInstruction[]
  keyword_integration: KeywordIntegration[]
  optimization_focus: string[]
  // ... full schema
}

// Stage E: Content Generation
interface TailoredCv {
  summary: string
  experience: TailoredExperience[]
  projects: TailoredProject[]
  skills: TailoredSkills
  // ... full schema
}
```

### Error Handling & Diagnostics
- **Graceful Degradation**: If AI fails, return previous CV version with error note
- **Diagnostic Logging**: Each stage logs processing time, token usage, validation errors
- **User Feedback**: Clear error messages with actionable next steps
- **Retry Logic**: Automatic retries for transient AI API failures

---

## 6. Security Architecture

### Authentication & Authorization
- **Supabase Auth**: Email/password, OAuth providers, JWT token management
- **Row Level Security**: Database-enforced access control on all tables
- **Session Management**: Secure server-side sessions with httpOnly cookies
- **Route Protection**: Middleware validates authentication on protected routes

### API Security
- **Rate Limiting**: Upstash Redis-based limiting (20 req/min for chat endpoints)
- **Input Validation**: File size limits, MIME type checking, content sanitization
- **API Key Encryption**: AES-256-GCM encryption for stored credentials
- **CORS Protection**: Next.js built-in security headers
- **SQL Injection Prevention**: Drizzle ORM parameterized queries

### Encrypted API Key Storage
```typescript
// User API keys encrypted before database storage
const encryptedKey = await encrypt(apiKey, process.env.ENCRYPTION_SECRET!)
await supabase.from('profiles').update({ 
  preferences: { ...preferences, api_key: encryptedKey } 
})

// Decryption for use
const decryptedKey = await decrypt(encryptedApiKey, process.env.ENCRYPTION_SECRET!)
```

### File Security
- **Supabase Storage**: RLS policies ensure users can only access their files
- **File Validation**: Size limits (10MB), allowed MIME types, virus scanning
- **Secure URLs**: Time-limited signed URLs for file downloads
- **Content-Type Validation**: Verify file headers match declared types

### Message Validation & Truncation
Chat messages are validated and truncated to prevent abuse:
```typescript
const MAX_MESSAGE_LENGTH = 4000
const sanitizedMessage = message.slice(0, MAX_MESSAGE_LENGTH).trim()
```

---

## 7. Key Development Patterns

### Server Components by Default
- **Philosophy**: Use Server Components for data fetching and static content
- **Client Components**: Only when interactivity is required (`'use client'`)
- **Benefits**: Better performance, SEO, reduced bundle size

### Server Actions Pattern
Consistent pattern across all mutations:

```typescript
export async function updateApplicationAction(formData: FormData) {
  // 1. Configuration check
  if (!isSupabaseConfigured()) {
    return { error: "Database not configured" }
  }
  
  // 2. Authentication
  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: "Authentication required" }
  }
  
  // 3. Input validation
  const validatedData = updateSchema.safeParse(Object.fromEntries(formData))
  if (!validatedData.success) {
    return { error: "Invalid input data" }
  }
  
  // 4. Database operation (RLS enforced)
  const { error: dbError } = await supabase
    .from('applications')
    .update(validatedData.data)
    .eq('user_id', user.id)
    .eq('id', applicationId)
  
  if (dbError) {
    return { error: "Failed to update application" }
  }
  
  // 5. Cache revalidation
  revalidatePath('/dashboard/applications')
  return { success: true }
}
```

### Streaming for Long Operations
Server-Sent Events for AI operations:

```typescript
export async function GET(request: Request) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stage B: Job Analysis
        const jobAnalysis = await analyzeJobDescription(jobData)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          stage: 'B', 
          data: jobAnalysis 
        })}\n\n`))
        
        // Stage C: CV Matching
        const matchAnalysis = await analyzeMatch(cvData, jobAnalysis)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
          stage: 'C', 
          data: matchAnalysis 
        })}\n\n`))
        
        // ... continue through stages D and E
        
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    }
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
```

### Defensive Zod Schemas
Handle unpredictable AI output gracefully:

```typescript
// Accept anything, transform to expected shape, provide defaults
const flexibleSchema = z.object({
  title: z.any().transform(v => v == null ? "" : String(v)).default(""),
  skills: z.any()
    .transform(v => Array.isArray(v) ? v.map(String) : v ? [String(v)] : [])
    .default([]),
  score: z.coerce.number().min(0).max(100).default(0)
}).passthrough() // Allow extra fields AI might add
```

### Error Boundaries & Graceful Degradation
- **React Error Boundaries**: Catch component-level errors
- **API Fallbacks**: Serve cached data when external APIs fail
- **Progressive Enhancement**: Core functionality works without JavaScript
- **User-Friendly Messages**: Translate technical errors to actionable guidance

---

## 8. Environment Configuration

### Required Environment Variables
| Variable | Purpose | Example |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project endpoint | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public API key | `eyJhbGciOiJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API key for server operations | `eyJhbGciOiJ...` |
| `DATABASE_DIRECT_URL` | Direct Postgres connection (migrations) | `postgresql://...` |
| `DATABASE_URL` | Pooled connection (runtime) | `postgresql://...` |
| `ENCRYPTION_SECRET` | 32-byte hex key for API key encryption | Generate: `openssl rand -hex 32` |
| `UPSTASH_REDIS_REST_URL` | Redis endpoint for rate limiting | `https://xyz.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Redis authentication token | `AXn7...` |
| `NEXT_PUBLIC_APP_URL` | Application base URL | `https://app.jobclock.com` |

### Optional Environment Variables
| Variable | Purpose | Fallback |
|----------|---------|----------|
| `ADZUNA_APP_ID` | Adzuna API credentials | Mock data in development |
| `ADZUNA_APP_KEY` | Adzuna API credentials | Mock data in development |
| `ANTHROPIC_API_KEY` | Global Claude access | User-provided keys required |
| `OPENAI_API_KEY` | Global OpenAI access | User-provided keys required |
| `CRON_SECRET` | Health check authentication | Random string |

---

## 9. Development Workflow

### Local Setup
```bash
# Clone and install dependencies
git clone <repository>
cd job-assistant
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase credentials

# Apply database migrations
npm run db:migrate

# Run platform setup (execute in Supabase SQL editor)
# File: supabase/sql/platform-setup.sql

# Start development server
npm run dev
```

### Development Commands
```bash
npm run dev          # Next.js development server (http://localhost:3000)
npm run build        # Production build with type checking
npm run start        # Production server
npm run lint         # ESLint code quality checks
npm run test         # Vitest unit tests
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright end-to-end tests
npm run db:generate  # Generate Drizzle migrations from schema changes
npm run db:migrate   # Apply pending migrations to database  
npm run db:studio    # Browse database with Drizzle Studio UI
```

### Database Development
1. **Schema Changes**: Edit `src/lib/db/schema.ts`
2. **Generate Migration**: `npm run db:generate` 
3. **Review SQL**: Check generated migration in `drizzle/` folder
4. **Apply Migration**: `npm run db:migrate`

**Important**: Type changes require manual `USING` clause in migration SQL.

---

## 10. Performance Considerations

### Database Optimization
- **Strategic Indexing**: `user_id`, `status`, `created_at`, `url` columns indexed
- **Connection Pooling**: Supabase transaction pooler for high concurrency
- **Query Optimization**: Avoid N+1 queries, use parallel fetches
- **RLS Efficiency**: Policies leverage indexed columns

### Frontend Performance
- **Server-Side Rendering**: Initial page loads via SSR
- **Streaming**: React 19 Suspense for progressive content loading
- **Code Splitting**: Dynamic imports for large components
- **Image Optimization**: Next.js Image component with lazy loading

### API Performance  
- **Parallel Job Fetching**: Multiple sources queried simultaneously
- **Response Streaming**: SSE for long-running AI operations
- **HTTP Caching**: Appropriate cache headers for static responses
- **Rate Limiting**: Protect against abuse while maintaining UX

### AI Optimization
- **Context Window Management**: Token counting to prevent truncation
- **Prompt Optimization**: Concise, focused prompts for faster responses
- **Response Caching**: Cache expensive AI operations where appropriate
- **Model Selection**: Use appropriate model size for task complexity

---

This architecture enables Jobclock to scale efficiently while maintaining high code quality and exceptional user experience. The modular design allows for easy feature additions and technology upgrades as the product evolves.