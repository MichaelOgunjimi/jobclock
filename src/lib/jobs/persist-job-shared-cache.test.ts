import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { beforeAll, describe, expect, it, vi } from "vitest"
import * as schema from "@/lib/db/schema"

// jobs_cache is shared by every user, so this runs the real upsert against a real Postgres (PGlite), not recorded SQL.
const mocks = vi.hoisted(() => ({ db: undefined as unknown }))
vi.mock("@/lib/db", () => ({ get db() { return mocks.db } }))
vi.mock("@/lib/generation/enqueue", () => ({ enqueueGeneration: vi.fn() }))
vi.mock("@/lib/applications/audit", () => ({ appendApplicationAuditEvents: vi.fn() }))

import { persistJobForUser } from "./persist-job"

const FIRST = "11111111-1111-4111-8111-111111111111"
const SECOND = "22222222-2222-4222-8222-222222222222"
const URL = "https://jobs.example.com/view/1"
let client: PGlite

beforeAll(async () => {
  client = new PGlite()
  await client.exec(`
    create table jobs_cache (id uuid primary key default gen_random_uuid(), url text not null unique, source text not null, title text not null, company text not null, location text, description text, salary_min numeric, salary_max numeric, salary_currency text default 'GBP', posted_at timestamptz, scraped_at timestamptz default now(), last_seen_at timestamptz default now(), is_easy_apply boolean default false, apply_deadline date, is_remote boolean, remote_type text, industry_key text, industry_label text);
    create table applications (id uuid primary key default gen_random_uuid(), slug text not null unique, user_id uuid not null, job_id uuid references jobs_cache(id), status text default 'saved', applied_at timestamptz, cover_letter_id uuid, selected_cv_id uuid, structure_id uuid, cover_letter_tone text, source text, notes text, tags text[], created_at timestamptz default now(), last_status_update timestamptz default now(), auto_apply_attempted boolean default false, auto_apply_success boolean, application_quality_score integer, right_to_work_confirmed boolean default false, custom_title text, custom_company text, custom_location text, custom_salary_text text, custom_description text, follow_up_due_at timestamptz, follow_up_count integer default 0, follow_up_notes text, interview_at timestamptz, archived_at timestamptz, unique (user_id, job_id));
  `)
  mocks.db = drizzle(client, { schema })
})

const save = (userId: string, description: string, extra = {}) =>
  persistJobForUser(userId, { url: URL, source: "extension", title: "Engineer", company: "Acme", description, ...extra }, { keepCachedJob: true, autoGenerate: false })
const cached = async () => (await client.query<{ title: string; description: string }>("select title, description from jobs_cache where url = $1", [URL])).rows
const appFor = async (userId: string) =>
  (await client.query<{ custom_description: string | null }>("select custom_description from applications where user_id = $1", [userId])).rows

describe("extension import and the shared jobs_cache (real SQL)", () => {
  it("a second user's import leaves the first user's cached row alone and keeps its own text on their application only", async () => {
    await save(FIRST, "First user's description")
    expect(await cached()).toEqual([{ title: "Engineer", description: "First user's description" }])
    expect(await appFor(FIRST)).toEqual([{ custom_description: null }])

    await save(SECOND, "Second user's extracted text", { title: "Hijacked title" })

    expect(await cached()).toEqual([{ title: "Engineer", description: "First user's description" }])
    expect(await appFor(FIRST)).toEqual([{ custom_description: null }])
    expect(await appFor(SECOND)).toEqual([{ custom_description: "Second user's extracted text" }])
  })

  it("does not add a copy when the user's text matches the cached text", async () => {
    await client.query("delete from applications where user_id = $1", [SECOND])
    await save(SECOND, "First user's description")
    expect(await appFor(SECOND)).toEqual([{ custom_description: null }])
  })

  it("without keepCachedJob (scraped search results) the cache is still refreshed", async () => {
    await persistJobForUser(FIRST, { url: URL, source: "adzuna", title: "Engineer", company: "Acme", description: "Fresh scrape" }, { autoGenerate: false })
    expect(await cached()).toEqual([{ title: "Engineer", description: "Fresh scrape" }])
  })
})
