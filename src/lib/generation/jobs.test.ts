import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/db", () => ({ db }))

import {
  createGenerationJob,
  findActiveJob,
  markRunning,
  markDone,
  markFailed,
  markSeen,
} from "./jobs"

describe("createGenerationJob", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("inserts a queued job and returns it (not deduped) when no active job exists", async () => {
    // no active job for (app, kind)
    const whereNoActive = vi.fn().mockResolvedValue([])
    db.select.mockReturnValue({ from: () => ({ where: whereNoActive }) })

    const inserted = {
      id: "job-1",
      userId: "user-1",
      applicationId: "app-1",
      kind: "cover_letter",
      status: "queued",
      resultRef: null,
      error: null,
      attempts: 0,
      params: null,
      seenAt: null,
    }
    const returning = vi.fn().mockResolvedValue([inserted])
    db.insert.mockReturnValue({ values: () => ({ returning }) })

    const result = await createGenerationJob({
      userId: "user-1",
      applicationId: "app-1",
      kind: "cover_letter",
    })

    expect(result.deduped).toBe(false)
    expect(result.job).toMatchObject({
      id: "job-1",
      kind: "cover_letter",
      status: "queued",
      applicationId: "app-1",
    })
  })

  it("returns the existing active job with deduped:true and does not insert", async () => {
    const active = {
      id: "job-active",
      userId: "user-1",
      applicationId: "app-1",
      kind: "cover_letter",
      status: "running",
    }
    db.select.mockReturnValue({
      from: () => ({ where: vi.fn().mockResolvedValue([active]) }),
    })

    const result = await createGenerationJob({
      userId: "user-1",
      applicationId: "app-1",
      kind: "cover_letter",
    })

    expect(result.deduped).toBe(true)
    expect(result.job).toMatchObject({ id: "job-active", status: "running" })
    expect(db.insert).not.toHaveBeenCalled()
  })
})

describe("findActiveJob", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the active job for (application, kind)", async () => {
    const active = { id: "job-9", applicationId: "app-1", kind: "cv_tailor", status: "queued" }
    db.select.mockReturnValue({
      from: () => ({ where: vi.fn().mockResolvedValue([active]) }),
    })

    const job = await findActiveJob("app-1", "cv_tailor")

    expect(job).toMatchObject({ id: "job-9", status: "queued" })
  })

  it("returns null when there is no active job (only done/failed exist)", async () => {
    db.select.mockReturnValue({
      from: () => ({ where: vi.fn().mockResolvedValue([]) }),
    })

    const job = await findActiveJob("app-1", "cv_tailor")

    expect(job).toBeNull()
  })
})

describe("lifecycle transitions", () => {
  let setArg: Record<string, unknown> | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    setArg = undefined
    db.update.mockReturnValue({
      set: (arg: Record<string, unknown>) => {
        setArg = arg
        return { where: vi.fn().mockResolvedValue(undefined) }
      },
    })
  })

  it("markRunning sets status to running", async () => {
    await markRunning("job-1")
    expect(setArg).toMatchObject({ status: "running" })
  })

  it("markDone sets status done and the result_ref", async () => {
    await markDone("job-1", "result-42")
    expect(setArg).toMatchObject({ status: "done", resultRef: "result-42" })
  })

  it("markFailed sets status failed, stores error, increments attempts", async () => {
    await markFailed("job-1", "LLM timeout")
    expect(setArg).toMatchObject({ status: "failed", error: "LLM timeout" })
    expect(setArg?.attempts).toBeDefined()
  })

  it("markSeen sets seenAt", async () => {
    await markSeen("job-1")
    expect(setArg?.seenAt).toBeInstanceOf(Date)
  })
})
