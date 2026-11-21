import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { beforeAll, describe, expect, it, vi } from "vitest"
import * as schema from "@/lib/db/schema"

// The credit cap is the one number standing between a prompt-injected agent and the owner's credits, so its SQL runs
// here against a real Postgres (PGlite) with just the columns it reads, not as recorded text.
const mocks = vi.hoisted(() => ({ db: undefined as unknown }))
vi.mock("@/lib/db", () => ({ get db() { return mocks.db } }))
vi.mock("@/lib/rate-limit", () => ({ mcpGenerationLimit: { limit: vi.fn() } }))
vi.mock("@/lib/generation/enqueue", () => ({ enqueueGeneration: vi.fn() }))
vi.mock("@/lib/ai/action", () => ({ runAiAction: vi.fn() }))

import { creditsUsedByConnection } from "./generation-tools"

const USER = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const CONN = "33333333-3333-4333-8333-333333333333"
const NOW = new Date("2026-11-21T12:00:00Z")
const since = new Date(NOW.getTime() - 86_400_000)
let client: PGlite

const job = (id: string, o: { user?: string; conn?: string | null; kind: string; status: string; at?: Date }) =>
  client.query("insert into generation_jobs (id, user_id, kind, status, requested_by_id, created_at) values ($1,$2,$3,$4,$5,$6)", [id, o.user ?? USER, o.kind, o.status, o.conn === undefined ? CONN : o.conn, (o.at ?? NOW).toISOString()])
let n = 0
const usage = (key: string, o: { credits: number; status?: string; source?: string; user?: string; at?: Date }) =>
  client.query("insert into ai_usage_actions (id, idempotency_key, user_id, feature, credential_source, status, credits, created_at) values (gen_random_uuid(),$1,$2,'x',$3,$4,$5,$6)", [`${key}`, o.user ?? USER, o.source ?? "jobclock", o.status ?? "completed", o.credits, (o.at ?? NOW).toISOString()])
const id = () => `aaaaaaaa-aaaa-4aaa-8aaa-${String(++n).padStart(12, "0")}`

beforeAll(async () => {
  client = new PGlite()
  await client.exec(`
    create table generation_jobs (id uuid primary key, user_id uuid not null, application_id uuid, kind text not null, status text not null, requested_by_id uuid, created_at timestamptz not null default now());
    create table ai_usage_actions (id uuid primary key, idempotency_key text not null unique, user_id uuid not null, feature text not null, credential_source text not null, status text not null, credits integer not null, created_at timestamptz not null default now());
  `)
  mocks.db = drizzle(client, { schema })
})

describe("creditsUsedByConnection (real SQL)", () => {
  it("counts what billing charged to this connection's finished jobs, including the research a cover letter composed", async () => {
    const a = id(), b = id()
    await job(a, { kind: "cover_letter", status: "done" })
    await usage(a, { credits: 4 })
    await usage(`${a}:company_research`, { credits: 8 })
    await job(b, { kind: "cv_tailor", status: "done" })
    await usage(b, { credits: 6 })
    expect(await creditsUsedByConnection(USER, CONN, since)).toBe(18)
  })

  it("counts a queued or running job at its worst-case cost, and nothing for a failed (released) one", async () => {
    const before = await creditsUsedByConnection(USER, CONN, since)
    await job(id(), { kind: "company_research", status: "queued" })
    await job(id(), { kind: "cover_letter", status: "running" })
    expect(await creditsUsedByConnection(USER, CONN, since)).toBe(before + 8 + 12)
    const failed = id()
    await job(failed, { kind: "company_research", status: "failed" })
    await usage(failed, { credits: 8, status: "failed" })
    expect(await creditsUsedByConnection(USER, CONN, since)).toBe(before + 8 + 12)
  })

  it("ignores the owner's own AI key, other connections, other users, web-started jobs and anything older than the window", async () => {
    const before = await creditsUsedByConnection(USER, CONN, since)
    const mine = id()
    await job(mine, { kind: "cv_tailor", status: "done" })
    await usage(mine, { credits: 6, source: "personal" })
    const other = id(), foreign = id(), web = id(), old = id()
    await job(other, { kind: "cv_tailor", status: "done", conn: "44444444-4444-4444-8444-444444444444" })
    await usage(other, { credits: 6 })
    await job(foreign, { kind: "cv_tailor", status: "done", user: OTHER })
    await usage(foreign, { credits: 6, user: OTHER })
    await job(web, { kind: "cv_tailor", status: "done", conn: null })
    await usage(web, { credits: 6 })
    await job(old, { kind: "cv_tailor", status: "done", at: new Date(NOW.getTime() - 2 * 86_400_000) })
    await usage(old, { credits: 6 })
    expect(await creditsUsedByConnection(USER, CONN, since)).toBe(before)
  })

  it("counts this connection's CV reviews from their billing key, not another's", async () => {
    const before = await creditsUsedByConnection(USER, CONN, since)
    await usage(`mcp:${CONN}:cv_review:cv-1:1`, { credits: 2 })
    await usage(`mcp:44444444-4444-4444-8444-444444444444:cv_review:cv-1:1`, { credits: 2 })
    await usage(`mcp:${CONN}:cv_review:cv-2:1`, { credits: 2, status: "failed" })
    expect(await creditsUsedByConnection(USER, CONN, since)).toBe(before + 2)
  })
})
