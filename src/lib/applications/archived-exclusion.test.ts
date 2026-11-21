import { PgDialect } from "drizzle-orm/pg-core"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Every drizzle query records its WHERE clause; the tests render it to SQL and check the archived rule is in it.
const mocks = vi.hoisted(() => {
  const wheres: unknown[] = []
  const chain: Record<string, unknown> = {}
  for (const method of ["from", "innerJoin", "leftJoin", "orderBy", "groupBy", "limit"]) chain[method] = () => chain
  chain.where = (clause: unknown) => {
    wheres.push(clause)
    return chain
  }
  chain.then = (resolve: (rows: unknown[]) => unknown) => resolve([])
  return { wheres, chain }
})
vi.mock("@/lib/db", () => ({ db: { select: () => mocks.chain } }))
vi.mock("@/lib/generation/enqueue", () => ({ enqueueGeneration: vi.fn() }))
vi.mock("@/lib/email/sent-log", () => ({ sentKeys: vi.fn().mockResolvedValue(new Set()) }))
vi.mock("@/lib/email/optional", () => ({ sendOptionalEmail: vi.fn() }))

import { sendDeadlineReminders, sendFollowUpReminders, sendInterviewReminders, sendStaleApplicationNudges } from "@/lib/email/application-emails"
import { listRecentApplicationsForUser } from "@/lib/jobs/persist-job"
import { getDigestData } from "@/lib/telegram/digest"
import { getApplicationStats } from "@/lib/telegram/stats"

const ARCHIVED_RULE = '"applications"."archived_at" is null'
const dialect = new PgDialect()
const renderedWheres = () => mocks.wheres.map((clause) => dialect.sqlToQuery(clause as never).sql)

describe("archived applications are left out of reminders, digests and stats", () => {
  beforeEach(() => {
    mocks.wheres.length = 0
  })

  it.each([
    ["follow-up reminder emails", () => sendFollowUpReminders()],
    ["deadline reminder emails", () => sendDeadlineReminders()],
    ["interview reminder emails", () => sendInterviewReminders()],
    ["stale-application nudge emails", () => sendStaleApplicationNudges()],
    ["Telegram stats (counts and weekly activity)", () => getApplicationStats("u1")],
    ["recent applications in Telegram and the import API", () => listRecentApplicationsForUser("u1", "https://jobclock.dev")],
  ])("%s: every query over applications filters archived rows", async (_name, run) => {
    await run()
    const sqls = renderedWheres()
    expect(sqls.length).toBeGreaterThan(0)
    for (const sql of sqls) expect(sql).toContain(ARCHIVED_RULE)
  })

  it("the weekly digest (Telegram and email) excludes archived follow-ups and stats", async () => {
    await getDigestData("u1")
    const sqls = renderedWheres()
    expect(sqls).toHaveLength(3) // follow-ups + status counts + weekly activity
    for (const sql of sqls) expect(sql).toContain(ARCHIVED_RULE)
  })
})
