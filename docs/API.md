# API Documentation

> **Project**: Job Assistant ("Clock") - Job application assistant for UK graduate/entry-level roles  
> **Last Updated**: 2026-03-30

This document covers all API routes and server actions in the Next.js job application assistant.

---

## Table of Contents

1. [API Routes](#api-routes)
2. [Server Actions](#server-actions)

---

## API Routes

### Authentication
All API routes require authentication via Supabase unless otherwise noted. Routes return `401 Unauthorized` for unauthenticated requests.

### Rate Limiting
- **Chat API**: 20 requests/minute per user
- **CV generation**: Rate limited per user
- **AI generation**: Rate limited per user

---

### 1. CV Upload and Parsing

#### `POST /api/cv/upload`

Upload and parse CV files with AI extraction.

**Auth**: Required

**Request**: `FormData`
- `file` (File): PDF or DOCX file (max 10MB)
- `name` (string, optional): Custom CV name

**File Requirements**:
- **Types**: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/msword`
- **Size limit**: 10MB
- **Content**: Must extract at least 50 characters of readable text

**Response**:
```typescript
// Success (200)
{
  success: true,
  cvId: string,
  parsed: CvData,
  fileUrl: string
}

// Error (400/422/500/503)
{
  error: string
}
```

**Error Cases**:
- `400`: No file provided, file too large, invalid file type
- `422`: Failed to parse file, insufficient text content, AI parsing failed
- `500`: Database/storage error
- `503`: Supabase not configured

---

### 2. Job Search

#### `GET /api/jobs/search`

Multi-source job search with filtering and pagination.

**Auth**: Required

**Query Parameters**:
- `q` (string, optional): Search query
- `location` (string, optional): Location filter
- `salary_min` (number, optional): Minimum salary
- `page` (number, default: 1): Page number (min: 1)
- `per_page` (number, default: 20): Results per page (min: 1, max: 50)
- `sort` (string, default: "relevance"): Sort order (`relevance`, `date`, `salary`)
- `experience` (string, optional): Comma-separated experience levels (`entry_level`, `graduate`, `junior`, `mid`, `senior`, `lead`)
- `sources` (string, default: "adzuna"): Comma-separated job sources (`adzuna`, `reed`, `careerjet`)

**Response**:
```typescript
{
  jobs: Job[],
  total: number,
  page: number,
  perPage: number
}

// Job interface
interface Job {
  url: string,
  source: string,
  title: string,
  company: string,
  location?: string,
  description?: string,
  salaryMin?: number,
  salaryMax?: number,
  salaryCurrency?: string,
  postedAt?: string,
  isEasyApply?: boolean
}
```

**Notes**:
- Reed requires API key configured in user preferences
- CareerJet requires `CAREERJET_API_KEY` environment variable
- Results are deduplicated by URL across sources
- Experience levels are mapped to source-specific search terms

---

### 3. AI Chat Assistant

#### `POST /api/chat/application`

Streaming AI chat assistant with application context.

**Auth**: Required  
**Rate Limit**: 20 requests/minute per user

**Request**:
```typescript
{
  messages: Array<{
    role: "user" | "assistant",
    content: string
  }>,
  applicationId: string
}
```

**Request Limits**:
- Message history capped to last 20 messages
- Message content limited to 10,000 characters each

**Response**: Server-Sent Events (text/plain)
- Streams AI response text as plain text
- Uses current application context (job details, CV data)
- Supports web search tool

**Error Cases**:
- `400`: Invalid request format
- `404`: Application not found
- `422`: No AI API key configured
- `429`: Rate limit exceeded

---

### 4. CV Tailoring (4-Stage Pipeline)

#### `POST /api/applications/[id]/cv/generate`

4-stage AI-powered CV tailoring with real-time progress.

**Auth**: Required  
**Rate Limit**: Rate limited per user

**Request**: No body required

**Response**: Server-Sent Events (text/event-stream)

Progress events:
```typescript
type GenerationProgressEvent = 
  | { stage: "B" | "C" | "D" | "E", status: "running" | "done" | "error", error?: string }
  | { done: true }
```

**Pipeline Stages**:
- **Stage B**: Job description analysis
- **Stage C**: CV-job match analysis  
- **Stage D**: CV tailoring plan generation
- **Stage E**: Tailored CV content generation

**Final Output**: Creates record in `customized_cvs` table with:
- Tailored CV JSON data
- ATS match score
- Skills gap analysis
- Matched/missing keywords

**Error Cases**:
- `404`: Application not found
- `422`: No job description, no CV found, no AI API key
- `429`: Rate limit exceeded
- Various stage-specific validation errors

---

### 5. PDF Generation

#### `GET /api/applications/[id]/cv/pdf`

Generate and download tailored CV as PDF.

**Auth**: Required

**Query Parameters**:
- `template` (string, optional): Template name (defaults to "modern")

**Response**: 
- **Content-Type**: `application/pdf`
- **Content-Disposition**: `attachment; filename="tailored-cv-{title}-{company}.pdf"`

Uses Puppeteer to render HTML/CSS template to PDF.

---

#### `GET /api/applications/[id]/cover-letter/pdf`

Generate and download cover letter as PDF.

**Auth**: Required

**Query Parameters**:
- `template` (string, optional): Template name (defaults to "modern")

**Response**:
- **Content-Type**: `application/pdf`
- **Content-Disposition**: `attachment; filename="cover-letter-{title}-{company}.pdf"`

---

### 6. Cover Letter Processing

#### `POST /api/cover-letter/parse`

Parse cover letter content from uploaded files.

**Auth**: Required

**Request**: `FormData`
- `file` (File): PDF or DOCX file

**Response**:
```typescript
// Success (200)
{
  content: string
}

// Error (400/500)
{
  error: string
}
```

**Supported Formats**: PDF, DOC, DOCX

---

### 7. Template Management

#### `POST /api/template/upload`

Upload DOCX template files for CV or cover letter generation.

**Auth**: Required

**Request**: `FormData`
- `file` (File): DOCX file (max 10MB)
- `type` ("cv" | "cover_letter"): Template type

**File Requirements**:
- **Type**: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- **Size limit**: 10MB

**Response**:
```typescript
// Success (200)
{
  path: string
}

// Error (400/500)
{
  error: string
}
```

---

#### `GET /api/template/file/[type]`

Download user's uploaded template file.

**Auth**: Required

**URL Parameters**:
- `type`: "cv" or "cover_letter"

**Response**:
- **Content-Type**: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Returns template file binary data

**Error Cases**:
- `400`: Invalid type
- `404`: Template not found

---

### 8. System Monitoring

#### `GET /api/cron/ping`

Internal heartbeat endpoint for cron job monitoring.

**Auth**: Bearer token via `CRON_SECRET` environment variable

**Response**:
```typescript
// Success (200)
{
  ok: true,
  ts: string // ISO timestamp
}

// Error (401/500)
{
  error: string
}
```

**Purpose**: Keeps Upstash Redis connection alive via Vercel cron jobs.

---

## Server Actions

Server actions handle form submissions and database operations. All actions require authentication and check Supabase configuration.

### Profile Management

#### From `src/app/(dashboard)/profile/actions.ts`

##### `setPrimaryCV(formData: FormData)`
**Parameters**: 
- `cvId` (string): CV ID to set as primary

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Sets specified CV as primary and clears primary flag from others. First CV uploaded automatically becomes primary.

---

##### `deleteCv(formData: FormData)`
**Parameters**:
- `cvId` (string): CV ID to delete

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Deletes CV record and associated file from storage. If deleted CV was primary, promotes most recent remaining CV to primary.

---

##### `saveCvData(cvId: string, data: CvData)`
**Parameters**:
- `cvId` (string): CV ID
- `data` (CvData): Parsed CV data object

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Updates parsed CV JSON data in database.

---

##### `renameCv(formData: FormData)`
**Parameters**:
- `cvId` (string): CV ID
- `name` (string): New CV name

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Updates CV display name.

---

##### `saveWritingStyle(formData: FormData)`
**Parameters**:
- `id` (string, optional): Writing style ID for updates
- `label` (string): Style display name
- `content` (string): Style template content
- `default_tone` (WritingStyleTone): Default tone for this style

**Returns**: `{ error?: string; success?: boolean; style?: object }`

**What it does**: Creates or updates custom cover letter writing style template.

---

##### `deleteWritingStyle(formData: FormData)`
**Parameters**:
- `id` (string): Writing style ID

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Deletes custom writing style (built-in styles cannot be deleted).

---

##### `savePreferences(payload: object)`
**Parameters**:
- `desiredRoles` (string[]): Preferred job roles
- `locationsUk` (string[]): Preferred UK locations
- `targetSalaryMin` (number | null): Minimum target salary
- `rightToWorkUk` (boolean): Right to work in UK
- `experienceLevel` (string[]): Experience levels

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Updates user job search preferences.

---

### Job Management

#### From `src/app/(dashboard)/jobs/actions.ts`

##### `saveJob(job: Job)`
**Parameters**:
- `job` (Job): Job object with URL, title, company, etc.

**Returns**: `{ error?: string; success?: boolean; alreadySaved?: boolean }`

**What it does**: Saves job to cache and creates application record. Deduplicates by URL to prevent duplicate applications.

---

### Settings Management

#### From `src/app/(dashboard)/settings/actions.ts`

##### `saveAiSettings(formData: FormData)`
**Parameters**:
- `provider` ("anthropic" | "openai"): AI provider
- `model` (string): Model ID for selected provider
- `anthropic_api_key` (string, optional): Anthropic API key
- `openai_api_key` (string, optional): OpenAI API key

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Saves AI provider settings and encrypts API keys. Only overwrites API keys if new values provided.

---

##### `saveJobSources(sources: JobSources)`
**Parameters**:
- `sources` (JobSources): Job source configuration object

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Updates job source preferences (Adzuna, Reed API keys, etc.).

---

##### `saveTemplate(type: string, path: string)`
**Parameters**:
- `type` ("cv" | "cover_letter"): Template type
- `path` (string): Storage path to template file

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Links uploaded template file to user profile.

---

##### `deleteTemplate(type: string)`
**Parameters**:
- `type` ("cv" | "cover_letter"): Template type

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Removes template file from storage and clears profile reference.

---

##### `saveDocumentTemplate(type: string, template: string)`
**Parameters**:
- `type` ("cv" | "cover_letter"): Document type
- `template` (string): Template name/ID

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Sets preferred built-in template for document type.

---

### Account Management

#### From `src/app/(dashboard)/account/actions.ts`

##### `saveAccountInfo(payload: object)`
**Parameters**:
- `fullName` (string): User's full name
- `phone` (string): Phone number
- `linkedinUrl` (string): LinkedIn profile URL
- `githubUrl` (string): GitHub profile URL
- `portfolioUrl` (string): Portfolio website URL
- `avatarUrl` (string): Avatar image URL

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Updates user profile information.

---

### Application Management

#### From `src/app/(dashboard)/applications/[id]/actions.ts`

##### `updateStatus(formData: FormData)`
**Parameters**:
- `applicationId` (string): Application ID
- `status` (ApplicationStatus): New status

**What it does**: Updates application status. Sets `applied_at` timestamp when status changes to "applied".

---

##### `updateNotes(formData: FormData)`
**Parameters**:
- `applicationId` (string): Application ID
- `notes` (string): Application notes

**What it does**: Updates application notes field.

---

##### `updateCv(formData: FormData)`
**Parameters**:
- `applicationId` (string): Application ID
- `cvId` (string): CV ID to use for this application

**What it does**: Links specific CV to application.

---

##### `updateCoverLetter(formData: FormData)`
**Parameters**:
- `applicationId` (string): Application ID
- `coverLetterId` (string): Cover letter ID

**What it does**: Links cover letter to application.

---

##### `updateWritingStyle(formData: FormData)`
**Parameters**:
- `applicationId` (string): Application ID
- `structureId` (string): Writing style structure ID
- `tone` (string): Cover letter tone

**What it does**: Sets cover letter writing style and tone for application.

---

##### `deleteApplication(applicationId: string)`
**Parameters**:
- `applicationId` (string): Application ID

**What it does**: Deletes application and redirects to applications list.

---

##### `updateDescription(formData: FormData)`
**Parameters**:
- `applicationId` (string): Application ID
- `description` (string): Custom job description

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Updates custom job description for better AI context.

---

##### `generateCoverLetter(applicationId: string)`
**Parameters**:
- `applicationId` (string): Application ID

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: AI-generates personalized cover letter using job context, CV data, and writing style preferences. Replaces any existing generated cover letter.

---

### CV Customization Actions

#### From `src/app/(dashboard)/applications/[id]/cv/actions.ts`

##### `saveTemplatePreference(template: string)`
**Parameters**:
- `template` (string): Template name

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Saves user's preferred CV template choice.

---

##### `saveCustomizedCvData({ applicationId, customizedCvId, data })`
**Parameters**:
- `applicationId` (string): Application ID
- `customizedCvId` (string): Customized CV record ID
- `data` (CvData): Updated CV data

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Updates tailored CV content after AI generation or manual edits.

---

### Cover Letter Actions

#### From `src/app/(dashboard)/applications/[id]/cover-letter/actions.ts`

##### `saveCoverLetterContent({ applicationId, coverLetterId, content })`
**Parameters**:
- `applicationId` (string): Application ID
- `coverLetterId` (string): Cover letter record ID
- `content` (string): Cover letter content

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Updates cover letter text content.

---

##### `saveCoverLetterTemplatePreference(template: string)`
**Parameters**:
- `template` (string): Template name

**Returns**: `{ error?: string; success?: boolean }`

**What it does**: Saves user's preferred cover letter template for PDF generation.

---

## Error Handling Patterns

All API routes and server actions follow consistent error patterns:

- **Authentication**: `401 Unauthorized` for missing/invalid auth
- **Authorization**: `404 Not Found` for resources user doesn't own
- **Validation**: `400 Bad Request` for invalid input
- **Processing**: `422 Unprocessable Entity` for business logic failures
- **Rate Limits**: `429 Too Many Requests` with descriptive message
- **Server Errors**: `500 Internal Server Error` for unexpected failures

Server actions return `{ error?: string; success?: boolean }` objects instead of throwing exceptions.

---

## Rate Limiting

The application implements several rate limits:

- **Chat API**: 20 requests/minute per user ID
- **CV Generation**: Rate limited per user (exact limits defined in implementation)  
- **AI Generation**: Rate limited per user for cover letter generation

Rate limiting uses Redis (via Upstash) for state tracking across serverless function invocations.