import { and, eq, gte, like, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { aiUsageActions, generationJobs, interviewPrep } from "@/lib/db/schema"
import { appendApplicationAuditEvents } from "@/lib/applications/audit"
import { MissingAiApiKeyError } from "@/lib/ai"
import { AiAllowanceExhaustedError } from "@/lib/billing/usage"
import { AI_CREDIT_WEIGHTS, type AiFeature } from "@/lib/billing/plans"
import { reviewSavedCvForUser } from "@/lib/cv/review-service"
import { enqueueGeneration } from "@/lib/generation/enqueue"
import { findActiveJob, type GenerationKind } from "@/lib/generation/jobs"
import { SCOPE_PROFILE_READ, SCOPE_INTERVIEW_READ, SCOPE_READ } from "@/lib/oauth/config"
import { mcpGenerationLimit } from "@/lib/rate-limit"
import { currentConnection, type McpConnection } from "./connection-context"
import { getCredits } from "./inbox-tools"
import { limitMessage, MCP_GENERATIONS_PER_MINUTE } from "./limits"
import { recordProfileEvent } from "./private-data"
import { DAY_MS, findApplication, MCP_SOURCE, NOT_FOUND, type ToolOutcome } from "./tools"

/**
 * AI generation for an agent holding ai:generate. Every tool goes through the same code the web app uses:
 * enqueueGeneration (rate limit, dedupe, QStash or inline dispatch) and the generation handlers, whose runAiAction call
 * does the plan check and the credit reserve/settle. This file adds only what the web app does not need: the owner's
 * per-connection daily credit cap (checked before anything is enqueued), a per-minute limit per connection, ownership
 * checks, and attribution of each job to the connection so the cap can be counted from credits actually charged.
 */

export const GENERATION_TOOLS = {
  generate_company_research: { kind: "company_research", feature: "company_research", readWith: "get_company_research", scope: SCOPE_READ },
  generate_cover_letter: { kind: "cover_letter", feature: "cover_letter", readWith: "get_cover_letter", scope: SCOPE_PROFILE_READ },
  tailor_cv: { kind: "cv_tailor", feature: "cv_tailoring", readWith: "get_tailored_cv", scope: SCOPE_PROFILE_READ },
  generate_interview_prep: { kind: "interview_prep", feature: "interview_preparation", readWith: "get_interview_prep", scope: SCOPE_INTERVIEW_READ },
} as const satisfies Record<string, { kind: GenerationKind; feature: AiFeature; readWith: string; scope: string }>

export type GenerationToolName = keyof typeof GENERATION_TOOLS

const credits = (feature: AiFeature) => AI_CREDIT_WEIGHTS[feature]
/** Wording for tool descriptions, so the stated cost can never drift from the billing table. */
export const costText = (feature: AiFeature) => `${credits(feature)} credits`
/** A cover letter first writes company research when the application has none, which is charged as well. */
export const COVER_LETTER_MAX_CREDITS = credits("cover_letter") + credits("company_research")

const CAP_WHERE = "Settings -> AI Agent, on this token or connected app (AI credits per day)"
const REVIEW_WINDOW_MS = 5 * 60_000

const kindCost = (kind: GenerationKind): number =>
  kind === "cover_letter" ? COVER_LETTER_MAX_CREDITS
    : kind === "company_research" ? credits("company_research")
    : kind === "cv_tailor" ? credits("cv_tailoring")
    : kind === "interview_prep" ? credits("interview_preparation")
    : credits("interview_answer")

// A job that has not run yet has charged nothing, so it counts at its worst-case cost until it finishes.
const COSTED_KINDS = ["company_research", "cover_letter", "cv_tailor", "interview_prep", "interview_answer"] as const satisfies readonly GenerationKind[]
const IN_FLIGHT_COST = sql`case ${generationJobs.kind} ${sql.raw(COSTED_KINDS.map((kind) => `when '${kind}' then ${kindCost(kind)}`).join(" "))} else 0 end`

// Qualified by hand: drizzle drops the table name from column references in a single-table query, and inside the
// subquery an unqualified "id" or "user_id" would silently mean the billing row's own.
const JOB_ID = sql.raw('"generation_jobs"."id"')
const JOB_USER = sql.raw('"generation_jobs"."user_id"')

/**
 * Credits this connection has used in the window: what the billing table says was charged to jobs it started (a failed
 * action is released and not counted), plus the worst-case cost of its jobs that are still waiting or running, plus
 * its CV reviews. Only credits JobClock actually charged count: with the owner's own AI key nothing is charged.
 */
export async function creditsUsedByConnection(userId: string, connectionId: string, since: Date): Promise<number> {
  const [[jobs], [reviews]] = await Promise.all([
    db
      .select({
        total: sql<number>`coalesce(sum(case when ${generationJobs.status} in ('queued', 'running') then ${IN_FLIGHT_COST} else coalesce((
          select sum(${aiUsageActions.credits}) from ${aiUsageActions}
          where ${aiUsageActions.userId} = ${JOB_USER}
            and ${aiUsageActions.status} <> 'failed'
            and ${aiUsageActions.credentialSource} = 'jobclock'
            and (${aiUsageActions.idempotencyKey} = ${JOB_ID}::text or ${aiUsageActions.idempotencyKey} = ${JOB_ID}::text || ':company_research')
        ), 0) end), 0)::int`,
      })
      .from(generationJobs)
      .where(and(eq(generationJobs.userId, userId), eq(generationJobs.requestedById, connectionId), gte(generationJobs.createdAt, since))),
    db
      .select({ total: sql<number>`coalesce(sum(${aiUsageActions.credits}), 0)::int` })
      .from(aiUsageActions)
      .where(and(
        eq(aiUsageActions.userId, userId),
        sql`${aiUsageActions.status} <> 'failed'`,
        eq(aiUsageActions.credentialSource, "jobclock"),
        gte(aiUsageActions.createdAt, since),
        like(aiUsageActions.idempotencyKey, `mcp:${connectionId}:cv_review:%`),
      )),
  ])
  return (jobs?.total ?? 0) + (reviews?.total ?? 0)
}

type Gate = { connection: McpConnection; cap: number | null } | { error: string }

/** The per-minute limit and the owner's credit cap. Runs before anything is enqueued or charged. `cost` 0 skips the cap (a dedupe costs nothing). */
async function gate(userId: string, cost: number, now: Date): Promise<Gate> {
  const connection = currentConnection()
  if (!connection) return { error: "AI generation needs a known connection (token or connected app). Call it through the MCP endpoint." }
  const cap = connection.dailyCreditCap
  if (cap === 0) {
    return { error: limitMessage("Not started: AI generation is switched off for this connection (its daily credit limit is 0)", "The owner decides whether an agent may spend their AI credits at all.", `The owner can change it in JobClock under ${CAP_WHERE}.`) }
  }
  if (!(await mcpGenerationLimit.limit(connection.id)).success) {
    return { error: limitMessage(`Too many generation requests: more than ${MCP_GENERATIONS_PER_MINUTE} a minute from this connection`, "Each one can spend the owner's AI credits, so bursts are slowed down whatever they cost. Wait a minute.") }
  }
  if (cap !== null && cost > 0) {
    const used = await creditsUsedByConnection(userId, connection.id, new Date(now.getTime() - DAY_MS))
    if (used + cost > cap) {
      return {
        error: limitMessage(
          `Not started: this call costs up to ${cost} credits, this connection has used ${used} of its ${cap}-credit daily limit in the last 24 hours, so it would go over`,
          "The limit stops an agent that loops, or one that was fed malicious text, from using up the owner's AI credits. The credits are the owner's, charged to their plan.",
          `The owner can raise it, or choose no limit, in JobClock under ${CAP_WHERE}.`,
        ),
      }
    }
  }
  return { connection, cap }
}

async function creditsRemaining(userId: string): Promise<number | undefined> {
  try {
    const outcome = await getCredits(userId)
    const total = "data" in outcome ? outcome.data.total_remaining : undefined
    return typeof total === "number" ? total : undefined
  } catch {
    return undefined
  }
}

async function hasResearch(userId: string, applicationId: string): Promise<boolean> {
  const [row] = await db
    .select({ content: interviewPrep.researchContent })
    .from(interviewPrep)
    .where(eq(interviewPrep.applicationId, applicationId))
    .limit(1)
  return Boolean(row?.content)
}

/** What a started job reports: ids, state, what it can cost, and where to read the result. */
export async function startGeneration(userId: string, tool: GenerationToolName, applicationId: string, now = new Date()): Promise<ToolOutcome> {
  const spec = GENERATION_TOOLS[tool]
  const application = await findApplication(userId, applicationId)
  if (!application) return NOT_FOUND
  if (application.archivedAt) return { error: "Not started: the application is archived. Generating for it would spend credits on something hidden; ask the owner, or restore_application first." }

  // An active job for this application and kind is reused by the queue (deduped), which costs nothing, so it skips the cap.
  const active = await findActiveJob(applicationId, spec.kind)
  const maxCost = spec.kind === "cover_letter" && (await hasResearch(userId, applicationId)) ? credits("cover_letter") : kindCost(spec.kind)
  const checked = await gate(userId, active ? 0 : maxCost, now)
  if ("error" in checked) return { error: checked.error }

  const queued = await enqueueGeneration({ userId, kind: spec.kind, applicationId, requestedBy: { kind: checked.connection.kind, id: checked.connection.id } })
  if ("error" in queued) return { error: queued.error }

  if (!queued.deduped) {
    await appendApplicationAuditEvents(db, {
      applicationId,
      userId,
      eventType: "application.generation_requested",
      metadata: { source: MCP_SOURCE, kind: spec.kind, generationJobId: queued.jobId, creditsAtMost: maxCost },
    })
  }
  const remaining = await creditsRemaining(userId)
  return {
    data: {
      job_id: queued.jobId,
      kind: spec.kind,
      application_id: applicationId,
      status: "queued",
      deduped: queued.deduped,
      credits_charged: 0,
      credits_at_most: queued.deduped ? 0 : maxCost,
      ...(remaining !== undefined ? { owner_credits_remaining: remaining } : {}),
      note: queued.deduped
        ? "The same generation for this application is already queued or running, so nothing new was started and nothing more is charged. Poll get_generation_status with this job_id."
        : `Started. It runs in the background and is charged to the owner's plan when it runs (this kind costs up to ${maxCost} credits; with the owner's own AI key nothing is charged). Poll get_generation_status with job_id; do not start it again.`,
      read_result_with: `${spec.readWith} (needs the ${spec.scope} permission)`,
    },
  }
}

/** The same metered cv_review action as the web button, run in the request (it is one short call, like the web route). */
export async function reviewCvForAgent(userId: string, cvId: string, now = new Date()): Promise<ToolOutcome> {
  const cost = credits("cv_review")
  const checked = await gate(userId, cost, now)
  if ("error" in checked) return { error: checked.error }

  // The key repeats within a few minutes, so a retry is refused by billing instead of being charged twice.
  const actionId = `mcp:${checked.connection.id}:cv_review:${cvId}:${Math.floor(now.getTime() / REVIEW_WINDOW_MS)}`
  const [existing] = await db
    .select({ credits: aiUsageActions.credits, status: aiUsageActions.status })
    .from(aiUsageActions)
    .where(and(eq(aiUsageActions.userId, userId), eq(aiUsageActions.idempotencyKey, actionId)))
    .limit(1)
  if (existing && existing.status !== "failed") {
    return { data: { kind: "cv_review", cv_id: cvId, status: "done", deduped: true, credits_charged: 0, note: "This CV was already reviewed a moment ago; nothing new was charged. Read the findings with get_cv (profile:read).", read_result_with: `get_cv with cv_id (needs the ${SCOPE_PROFILE_READ} permission)` } }
  }

  try {
    const reviewed = await reviewSavedCvForUser({ userId, cvId, actionId })
    if (!reviewed) return { error: "CV not found. Use an id from list_cvs." }
    const [charged] = await db
      .select({ credits: aiUsageActions.credits })
      .from(aiUsageActions)
      .where(and(eq(aiUsageActions.userId, userId), eq(aiUsageActions.idempotencyKey, actionId), eq(aiUsageActions.credentialSource, "jobclock")))
      .limit(1)
    await recordProfileEvent(db, userId, "profile.cv_reviewed", { cvId, credits: charged?.credits ?? 0 })
    const remaining = await creditsRemaining(userId)
    return {
      data: {
        kind: "cv_review",
        cv_id: cvId,
        status: "done",
        deduped: false,
        findings_count: reviewed.findings.length,
        credits_charged: charged?.credits ?? 0,
        ...(remaining !== undefined ? { owner_credits_remaining: remaining } : {}),
        note: "The review replaced the CV's saved findings. Read them with get_cv (profile:read). Charged to the owner's plan.",
        read_result_with: `get_cv with cv_id (needs the ${SCOPE_PROFILE_READ} permission)`,
      },
    }
  } catch (error) {
    if (error instanceof AiAllowanceExhaustedError || error instanceof MissingAiApiKeyError) return { error: `Not reviewed: ${error.message}` }
    console.error("review_cv failed", error)
    return { error: "The review failed and was not charged. Try again later." }
  }
}

// ── Status ──────────────────────────────────────────────────────────────────────────────────────────────────────

const RESULT_TOOL = Object.fromEntries(Object.values(GENERATION_TOOLS).map((spec) => [spec.kind, { tool: spec.readWith, scope: spec.scope }]))

/** Only the owner's own jobs, and only ones an MCP connection started: the web app's other jobs are not this tool's business. */
export async function getGenerationStatus(userId: string, jobId: string, scopes: readonly string[]): Promise<ToolOutcome> {
  const [job] = await db
    .select({
      id: generationJobs.id,
      kind: generationJobs.kind,
      status: generationJobs.status,
      applicationId: generationJobs.applicationId,
      error: generationJobs.error,
      createdAt: generationJobs.createdAt,
      updatedAt: generationJobs.updatedAt,
    })
    .from(generationJobs)
    .where(and(eq(generationJobs.id, jobId), eq(generationJobs.userId, userId), sql`${generationJobs.requestedById} is not null`))
    .limit(1)
  if (!job) return { error: "Generation job not found." }

  const [charged] = await db
    .select({ total: sql<number>`coalesce(sum(${aiUsageActions.credits}), 0)::int` })
    .from(aiUsageActions)
    .where(and(
      eq(aiUsageActions.userId, userId),
      sql`${aiUsageActions.status} <> 'failed'`,
      eq(aiUsageActions.credentialSource, "jobclock"),
      sql`(${aiUsageActions.idempotencyKey} = ${job.id} or ${aiUsageActions.idempotencyKey} = ${`${job.id}:company_research`})`,
    ))
  const result = RESULT_TOOL[job.kind]
  const remaining = await creditsRemaining(userId)
  return {
    data: {
      job_id: job.id,
      kind: job.kind,
      status: job.status,
      application_id: job.applicationId,
      created_at: job.createdAt.toISOString(),
      ...(job.status === "done" || job.status === "failed" ? { finished_at: job.updatedAt.toISOString() } : {}),
      ...(job.status === "failed" ? { error: (job.error ?? "The generation failed.").slice(0, 300), note: "A failed generation releases its credits." } : {}),
      credits_charged: charged?.total ?? 0,
      ...(remaining !== undefined ? { owner_credits_remaining: remaining } : {}),
      ...(job.status === "done" && result
        ? { read_result_with: result.tool, can_read_with_this_connection: scopes.includes(result.scope), ...(scopes.includes(result.scope) ? {} : { needs_permission: result.scope }) }
        : {}),
    },
  }
}
