import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  enqueueGeneration: vi.fn(),
  findActiveJob: vi.fn(),
  generationLimit: { limit: vi.fn() },
  reviewSavedCvForUser: vi.fn(),
  getCredits: vi.fn(),
  AiAllowanceExhaustedError: class extends Error {},
  MissingAiApiKeyError: class extends Error {},
}))
const { AiAllowanceExhaustedError, MissingAiApiKeyError } = mocks

vi.mock("@/lib/db", async () => ({ db: (await import("./fake-db")).fakeDb }))
vi.mock("@/lib/generation/enqueue", () => ({ enqueueGeneration: mocks.enqueueGeneration }))
vi.mock("@/lib/generation/jobs", () => ({ findActiveJob: mocks.findActiveJob }))
vi.mock("@/lib/rate-limit", () => ({ mcpGenerationLimit: mocks.generationLimit }))
vi.mock("@/lib/cv/review-service", () => ({ reviewSavedCvForUser: mocks.reviewSavedCvForUser }))
vi.mock("@/lib/billing/usage", () => ({ AiAllowanceExhaustedError: mocks.AiAllowanceExhaustedError }))
vi.mock("@/lib/ai", () => ({ MissingAiApiKeyError: mocks.MissingAiApiKeyError }))
vi.mock("./inbox-tools", () => ({ getCredits: mocks.getCredits }))

import { AI_CREDIT_WEIGHTS } from "@/lib/billing/plans"
import { runAsConnection, type McpConnection } from "./connection-context"
import { expectAllQueriesScopedTo, recorded, resetFakeDb, row, type RecordedQuery } from "./fake-db"
import { creditsUsedByConnection, getGenerationStatus, reviewCvForAgent, startGeneration, type GenerationToolName } from "./generation-tools"

const OWNER = "11111111-1111-4111-8111-111111111111"
const INTRUDER = "22222222-2222-4222-8222-222222222222"
const APP = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const CV = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
const JOB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
const NOW = new Date("2026-11-20T10:00:00.000Z")

const FIND_KEYS = ["id", "slug", "status", "appliedAt", "lastStatusUpdate", "followUpDueAt", "interviewAt", "customTitle", "customCompany", "jobTitle", "jobCompany", "archivedAt", "tags", "notes", "followUpNotes", "followUpCount", "source", "postingUrl"]

const state = { archived: false, used: 0, reviewUsed: 0, research: false, job: null as Record<string, unknown> | null, charged: 0, priorAction: null as [number, string] | null, chargedForReview: 2 }

const as = (connection: Partial<McpConnection> = {}) => <T>(fn: () => T) =>
  runAsConnection({ kind: "token", id: "tok-1", dailyCreateCap: 100, dailyDeleteCap: 10, dailyCreditCap: 20, ...connection }, fn)

beforeEach(() => {
  Object.assign(state, { archived: false, used: 0, reviewUsed: 0, research: false, job: null, charged: 0, priorAction: null, chargedForReview: 2 })
  for (const mock of [mocks.enqueueGeneration, mocks.findActiveJob, mocks.generationLimit.limit, mocks.reviewSavedCvForUser, mocks.getCredits]) mock.mockReset()
  mocks.generationLimit.limit.mockResolvedValue({ success: true })
  mocks.findActiveJob.mockResolvedValue(null)
  mocks.enqueueGeneration.mockResolvedValue({ jobId: JOB, deduped: false })
  mocks.getCredits.mockResolvedValue({ data: { total_remaining: 42 } })
  mocks.reviewSavedCvForUser.mockResolvedValue({ findings: [{}, {}] })
  resetFakeDb(({ sql, params }: RecordedQuery) => {
    // interview_prep has no user column: it is only reached after the application was found to be the owner's.
    if (/from "interview_prep"/.test(sql)) return [[state.research ? "Acme builds anvils." : null]]
    if (/^(insert|update|delete)/i.test(sql) || !params.includes(OWNER)) return []
    if (/^select coalesce\(sum\(case when/.test(sql)) return [[state.used]]
    if (/^select "id", "kind", "status"/.test(sql)) return state.job ? [row(["id", "kind", "status", "applicationId", "error", "createdAt", "updatedAt"], state.job)] : []
    if (/^select coalesce\(sum\("credits"\)/.test(sql) || /^select coalesce\(sum\("ai_usage_actions"/.test(sql)) return [[/like|ilike/.test(sql) ? state.reviewUsed : state.charged]]
    if (/^select "credits", "status"/.test(sql)) return state.priorAction ? [state.priorAction] : []
    if (/^select "credits" from "ai_usage_actions"/.test(sql)) return [[state.chargedForReview]]
    if (/from "applications"/.test(sql)) return [row(FIND_KEYS, { id: APP, slug: "s", status: "saved", customTitle: "Engineer", customCompany: "Acme", archivedAt: state.archived ? NOW : null })]
    return []
  })
})

const TOOLS: [GenerationToolName, string, number][] = [
  ["generate_company_research", "company_research", AI_CREDIT_WEIGHTS.company_research],
  ["generate_cover_letter", "cover_letter", AI_CREDIT_WEIGHTS.cover_letter + AI_CREDIT_WEIGHTS.company_research],
  ["tailor_cv", "cv_tailor", AI_CREDIT_WEIGHTS.cv_tailoring],
  ["generate_interview_prep", "interview_prep", AI_CREDIT_WEIGHTS.interview_preparation],
]

describe("generation goes through the same enqueue the web app uses", () => {
  it.each(TOOLS)("%s enqueues kind %s for the owner's application with the connection recorded, and reports the cost", async (tool, kind, cost) => {
    const result = await as()(() => startGeneration(OWNER, tool, APP, NOW))
    expect(mocks.enqueueGeneration).toHaveBeenCalledWith({ userId: OWNER, kind, applicationId: APP, requestedBy: { kind: "token", id: "tok-1" } })
    expect(result).toEqual({ data: expect.objectContaining({ job_id: JOB, kind, application_id: APP, status: "queued", deduped: false, credits_charged: 0, credits_at_most: cost, owner_credits_remaining: 42 }) })
    expect(JSON.stringify(result)).toContain("get_")
  })

  it("the stated costs are the billing table's: research 8, cover letter 4 (12 with research), tailoring 6, prep 4, review 2", () => {
    expect([AI_CREDIT_WEIGHTS.company_research, AI_CREDIT_WEIGHTS.cover_letter, AI_CREDIT_WEIGHTS.cv_tailoring, AI_CREDIT_WEIGHTS.interview_preparation, AI_CREDIT_WEIGHTS.cv_review]).toEqual([8, 4, 6, 4, 2])
  })

  it("a cover letter costs 4 when the application already has research and up to 12 when it does not", async () => {
    state.research = true
    expect(await as()(() => startGeneration(OWNER, "generate_cover_letter", APP, NOW))).toEqual({ data: expect.objectContaining({ credits_at_most: 4 }) })
    state.research = false
    expect(await as()(() => startGeneration(OWNER, "generate_cover_letter", APP, NOW))).toEqual({ data: expect.objectContaining({ credits_at_most: 12 }) })
  })

  it("records the generation on the application's audit trail with the kind and job id", async () => {
    await as()(() => startGeneration(OWNER, "tailor_cv", APP, NOW))
    const audit = recorded.find((query) => /^insert into "application_audit_events"/.test(query.sql))!
    expect(audit.params).toContain("application.generation_requested")
    expect(audit.params.join("")).toContain('"kind":"cv_tailor"')
    expect(audit.params.join("")).toContain(`"generationJobId":"${JOB}"`)
    expect(audit.params.join("")).toContain('"connectionId":"tok-1"')
  })

  it("a connection with no known token or app cannot generate", async () => {
    expect(await startGeneration(OWNER, "tailor_cv", APP, NOW)).toEqual({ error: expect.stringMatching(/known connection/) })
    expect(mocks.enqueueGeneration).not.toHaveBeenCalled()
  })

  it("passes on the queue's own refusal (its per-user rate limit)", async () => {
    mocks.enqueueGeneration.mockResolvedValue({ error: "Too many requests. Please wait a moment before trying again." })
    expect(await as()(() => startGeneration(OWNER, "tailor_cv", APP, NOW))).toEqual({ error: expect.stringMatching(/Too many requests/) })
  })
})

describe("the owner's daily credit cap is enforced before anything is enqueued", () => {
  it("a cap of 0 switches generation off: no limiter call, no enqueue", async () => {
    const result = await as({ dailyCreditCap: 0 })(() => startGeneration(OWNER, "tailor_cv", APP, NOW))
    expect(result).toEqual({ error: expect.stringMatching(/switched off[\s\S]*limit is 0[\s\S]*Settings -> AI Agent/) })
    expect(mocks.enqueueGeneration).not.toHaveBeenCalled()
  })

  it("refuses a call that would go over, naming its cost, the credits used today, the cap and where to change it", async () => {
    state.used = 18
    const result = await as({ dailyCreditCap: 20 })(() => startGeneration(OWNER, "generate_company_research", APP, NOW))
    expect(result).toEqual({ error: expect.stringMatching(/costs up to 8 credits[\s\S]*used 18 of its 20-credit daily limit[\s\S]*Settings -> AI Agent/) })
    expect(mocks.enqueueGeneration).not.toHaveBeenCalled()
    expect(recorded.some((query) => /^insert/i.test(query.sql))).toBe(false)
  })

  it("allows a call that lands exactly on the cap", async () => {
    state.used = 12
    expect(await as({ dailyCreditCap: 20 })(() => startGeneration(OWNER, "generate_company_research", APP, NOW))).toEqual({ data: expect.objectContaining({ job_id: JOB }) })
  })

  it("no limit (null) skips the cap entirely, however much was used", async () => {
    state.used = 100_000
    expect(await as({ dailyCreditCap: null })(() => startGeneration(OWNER, "generate_company_research", APP, NOW))).toEqual({ data: expect.objectContaining({ job_id: JOB }) })
    expect(recorded.some((query) => /^select coalesce\(sum\(case when/.test(query.sql))).toBe(false)
  })

  it("counts credits for this connection only, in the owner's rows, over the last 24 hours", async () => {
    await creditsUsedByConnection(OWNER, "tok-1", new Date(NOW.getTime() - 86_400_000))
    const jobs = recorded.find((query) => /from "generation_jobs"/.test(query.sql))!
    expect(jobs.params).toEqual(expect.arrayContaining([OWNER, "tok-1"]))
    expect(jobs.sql).toMatch(/"requested_by_id" = \$/)
    expect(jobs.sql).toMatch(/"status" <> 'failed'/) // a released (failed) action is not counted
    expect(jobs.sql).toMatch(/'queued', 'running'/) // jobs not yet run count at their worst case
    expectAllQueriesScopedTo(OWNER)
  })

  it("a repeat while a job is active is deduped: it skips the cap, is charged nothing and says so", async () => {
    state.used = 20
    mocks.findActiveJob.mockResolvedValue({ id: JOB, userId: OWNER })
    mocks.enqueueGeneration.mockResolvedValue({ jobId: JOB, deduped: true })
    const result = await as({ dailyCreditCap: 20 })(() => startGeneration(OWNER, "tailor_cv", APP, NOW))
    expect(result).toEqual({ data: expect.objectContaining({ job_id: JOB, deduped: true, credits_charged: 0, credits_at_most: 0 }) })
    expect(mocks.enqueueGeneration).toHaveBeenCalledTimes(1)
    expect(recorded.some((query) => /^insert into "application_audit_events"/.test(query.sql))).toBe(false)
  })

  it("the queue reporting deduped is passed on even when the pre-check missed it", async () => {
    mocks.enqueueGeneration.mockResolvedValue({ jobId: JOB, deduped: true })
    expect(await as()(() => startGeneration(OWNER, "tailor_cv", APP, NOW))).toEqual({ data: expect.objectContaining({ deduped: true, credits_at_most: 0 }) })
  })
})

describe("per-minute limit, ownership and archived applications", () => {
  it("refuses beyond the per-connection per-minute limit, keyed by the connection, before the cap or the queue", async () => {
    mocks.generationLimit.limit.mockResolvedValue({ success: false })
    const result = await as()(() => startGeneration(OWNER, "tailor_cv", APP, NOW))
    expect(result).toEqual({ error: expect.stringMatching(/more than 5 a minute from this connection/) })
    expect(mocks.generationLimit.limit).toHaveBeenCalledWith("tok-1")
    expect(mocks.enqueueGeneration).not.toHaveBeenCalled()
  })

  it("refuses an archived application without spending anything", async () => {
    state.archived = true
    expect(await as()(() => startGeneration(OWNER, "tailor_cv", APP, NOW))).toEqual({ error: expect.stringMatching(/archived/) })
    expect(mocks.enqueueGeneration).not.toHaveBeenCalled()
  })

  it.each(TOOLS)("%s with another user's application id is 'not found' and enqueues nothing", async (tool) => {
    expect(await as()(() => startGeneration(INTRUDER, tool, APP, NOW))).toEqual({ error: "Application not found." })
    expect(mocks.enqueueGeneration).not.toHaveBeenCalled()
    expectAllQueriesScopedTo(INTRUDER, [OWNER])
  })
})

describe("review_cv", () => {
  it("runs the shared review service as a metered action and reports cost, findings count and where to read them", async () => {
    const result = await as()(() => reviewCvForAgent(OWNER, CV, NOW))
    expect(mocks.reviewSavedCvForUser).toHaveBeenCalledWith({ userId: OWNER, cvId: CV, actionId: expect.stringMatching(new RegExp(`^mcp:tok-1:cv_review:${CV}:`)) })
    expect(result).toEqual({ data: expect.objectContaining({ kind: "cv_review", status: "done", deduped: false, findings_count: 2, credits_charged: 2, owner_credits_remaining: 42 }) })
    expect(JSON.stringify(result)).toContain("get_cv")
    expect(JSON.stringify(result)).not.toContain("suggestion") // findings are read with get_cv, not returned here
  })

  it("uses the same billing key for the same connection and CV within the window, so a retry cannot be charged twice", async () => {
    await as()(() => reviewCvForAgent(OWNER, CV, NOW))
    await as()(() => reviewCvForAgent(OWNER, CV, new Date(NOW.getTime() + 60_000)))
    const [first, second] = mocks.reviewSavedCvForUser.mock.calls.map((call) => call[0].actionId)
    expect(first).toBe(second)
    await as({ id: "tok-2" })(() => reviewCvForAgent(OWNER, CV, NOW))
    expect(mocks.reviewSavedCvForUser.mock.calls[2][0].actionId).not.toBe(first)
  })

  it("a review that was already charged is reported as deduped and runs nothing", async () => {
    state.priorAction = [2, "completed"]
    expect(await as()(() => reviewCvForAgent(OWNER, CV, NOW))).toEqual({ data: expect.objectContaining({ deduped: true, credits_charged: 0 }) })
    expect(mocks.reviewSavedCvForUser).not.toHaveBeenCalled()
  })

  it("is refused by the credit cap before it runs: cost 2", async () => {
    state.used = 19
    expect(await as({ dailyCreditCap: 20 })(() => reviewCvForAgent(OWNER, CV, NOW))).toEqual({ error: expect.stringMatching(/costs up to 2 credits[\s\S]*used 19 of its 20/) })
    expect(mocks.reviewSavedCvForUser).not.toHaveBeenCalled()
  })

  it("is refused when generation is off or the per-minute limit is hit", async () => {
    expect(await as({ dailyCreditCap: 0 })(() => reviewCvForAgent(OWNER, CV, NOW))).toEqual({ error: expect.stringMatching(/switched off/) })
    mocks.generationLimit.limit.mockResolvedValue({ success: false })
    expect(await as()(() => reviewCvForAgent(OWNER, CV, NOW))).toEqual({ error: expect.stringMatching(/Too many generation requests/) })
    expect(mocks.reviewSavedCvForUser).not.toHaveBeenCalled()
  })

  it("a CV that is not the owner's is 'not found'", async () => {
    mocks.reviewSavedCvForUser.mockResolvedValue(null)
    expect(await as()(() => reviewCvForAgent(OWNER, CV, NOW))).toEqual({ error: expect.stringMatching(/CV not found/) })
  })

  it("maps an exhausted allowance and a missing key to an error, and anything else to a generic one", async () => {
    mocks.reviewSavedCvForUser.mockRejectedValueOnce(new AiAllowanceExhaustedError("Your JobClock AI allowance has been used"))
    expect(await as()(() => reviewCvForAgent(OWNER, CV, NOW))).toEqual({ error: expect.stringMatching(/Not reviewed: Your JobClock AI allowance/) })
    mocks.reviewSavedCvForUser.mockRejectedValueOnce(new MissingAiApiKeyError("no key"))
    expect(await as()(() => reviewCvForAgent(OWNER, CV, NOW))).toEqual({ error: expect.stringMatching(/Not reviewed: no key/) })
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.reviewSavedCvForUser.mockRejectedValueOnce(new Error("provider said: secret detail"))
    const result = await as()(() => reviewCvForAgent(OWNER, CV, NOW))
    expect(result).toEqual({ error: expect.stringMatching(/not charged/) })
    expect(JSON.stringify(result)).not.toContain("secret detail")
  })

  it("is scoped to the caller", async () => {
    await as()(() => reviewCvForAgent(INTRUDER, CV, NOW))
    expectAllQueriesScopedTo(INTRUDER, [OWNER])
  })
})

describe("get_generation_status", () => {
  const job = (overrides: Record<string, unknown> = {}) => ({ id: JOB, kind: "cover_letter", status: "done", applicationId: APP, error: null, createdAt: NOW, updatedAt: new Date(NOW.getTime() + 60_000), ...overrides })

  it("is scoped to the owner and only to jobs an MCP connection started: a foreign or web job is 'not found'", async () => {
    state.job = job()
    expect(await getGenerationStatus(INTRUDER, JOB, ["ai:generate"])).toEqual({ error: "Generation job not found." })
    expectAllQueriesScopedTo(INTRUDER, [OWNER])
    const query = recorded[0]
    expect(query.sql).toMatch(/"requested_by_id" is not null/)
  })

  it("returns state, credits actually charged and where to read the result, never the generated text", async () => {
    state.job = job()
    state.charged = 12
    const result = await getGenerationStatus(OWNER, JOB, ["applications:read", "profile:read", "ai:generate"])
    expect(result).toEqual({ data: { job_id: JOB, kind: "cover_letter", status: "done", application_id: APP, created_at: NOW.toISOString(), finished_at: new Date(NOW.getTime() + 60_000).toISOString(), credits_charged: 12, owner_credits_remaining: 42, read_result_with: "get_cover_letter", can_read_with_this_connection: true } })
  })

  it.each([
    ["company_research", "get_company_research", "applications:read"],
    ["cover_letter", "get_cover_letter", "profile:read"],
    ["cv_tailor", "get_tailored_cv", "profile:read"],
    ["interview_prep", "get_interview_prep", "interview:read"],
  ])("%s points at %s and says when this connection lacks %s", async (kind, tool, scope) => {
    state.job = job({ kind })
    expect(await getGenerationStatus(OWNER, JOB, ["ai:generate"])).toEqual({ data: expect.objectContaining({ read_result_with: tool, can_read_with_this_connection: false, needs_permission: scope }) })
    expect(await getGenerationStatus(OWNER, JOB, ["ai:generate", scope])).toEqual({ data: expect.objectContaining({ can_read_with_this_connection: true }) })
  })

  it("a queued job has no result pointer yet; a failed one shows a short error and that credits are released", async () => {
    state.job = job({ status: "queued" })
    expect(JSON.stringify(await getGenerationStatus(OWNER, JOB, []))).not.toContain("read_result_with")
    state.job = job({ status: "failed", error: "x".repeat(1000) })
    const failed = (await getGenerationStatus(OWNER, JOB, [])) as { data: { error: string; note: string } }
    expect(failed.data.error).toHaveLength(300)
    expect(failed.data.note).toMatch(/releases its credits/)
  })

  it("an unknown job is 'not found'", async () => {
    expect(await getGenerationStatus(OWNER, JOB, [])).toEqual({ error: "Generation job not found." })
  })
})
