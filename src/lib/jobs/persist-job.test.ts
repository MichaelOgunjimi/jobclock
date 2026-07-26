import { beforeEach, describe, expect, it, vi } from "vitest"

const { db, enqueueGeneration } = vi.hoisted(() => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
  enqueueGeneration: vi.fn(),
}))

vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/generation/enqueue", () => ({ enqueueGeneration }))

import { persistJobForUser, updateApplicationStatusForUser } from "./persist-job"

describe("persistJobForUser", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.transaction.mockImplementation((callback) => callback(db))
  })

  it("returns the existing application when the same user already saved the job", async () => {
    const returningCachedJob = vi.fn().mockResolvedValue([{ id: "job-1" }])
    const onConflictDoUpdate = vi.fn(() => ({ returning: returningCachedJob }))
    const values = vi.fn(() => ({ onConflictDoUpdate }))

    const returningApplicationInsert = vi.fn().mockResolvedValue([])
    const onConflictDoNothing = vi.fn(() => ({ returning: returningApplicationInsert }))
    const valuesForApplication = vi.fn(() => ({ onConflictDoNothing }))

    db.insert
      .mockImplementationOnce(() => ({ values }))
      .mockImplementationOnce(() => ({ values: valuesForApplication }))
    db.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([{ id: "app-1" }]),
        }),
      }),
    }))

    const result = await persistJobForUser("user-1", {
      url: "https://example.com/job-1",
      source: "indeed",
      title: "Engineer",
      company: "Acme",
    })

    expect(result).toEqual({
      applicationId: "app-1",
      alreadySaved: true,
    })
    expect(values).toHaveBeenCalled()
    expect(onConflictDoUpdate).toHaveBeenCalled()
    expect(onConflictDoNothing).toHaveBeenCalled()
    expect(db.insert).toHaveBeenCalledTimes(2)
  })

  it("creates a saved application when the job is new for the user", async () => {
    const returningCachedJob = vi.fn().mockResolvedValue([{ id: "job-2" }])
    const onConflictDoUpdate = vi.fn(() => ({ returning: returningCachedJob }))
    const valuesForJob = vi.fn(() => ({ onConflictDoUpdate }))

    const returningApplication = vi.fn().mockResolvedValue([{ id: "app-2" }])
    const onConflictDoNothing = vi.fn(() => ({ returning: returningApplication }))
    const valuesForApplication = vi.fn(() => ({ onConflictDoNothing }))

    db.insert
      .mockImplementationOnce(() => ({ values: valuesForJob }))
      .mockImplementationOnce(() => ({ values: valuesForApplication }))
    db.select.mockImplementationOnce(() => ({
      from: () => ({ where: vi.fn().mockResolvedValue([{ preferences: {} }]) }),
    }))

    const result = await persistJobForUser("user-1", {
      url: "https://example.com/job-2",
      source: "linkedin",
      title: "Product Engineer",
      company: "Beta",
      salaryMin: 55000,
    })

    expect(result).toEqual({
      applicationId: "app-2",
      alreadySaved: false,
    })
    expect(valuesForApplication).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      jobId: "job-2",
      status: "saved",
    }))
    expect(onConflictDoNothing).toHaveBeenCalled()
  })

  it("queues CV tailoring when enabled for a newly saved application", async () => {
    const returningCachedJob = vi.fn().mockResolvedValue([{ id: "job-2" }])
    const onConflictDoUpdate = vi.fn(() => ({ returning: returningCachedJob }))
    const valuesForJob = vi.fn(() => ({ onConflictDoUpdate }))
    const returningApplication = vi.fn().mockResolvedValue([{ id: "app-2" }])
    const onConflictDoNothing = vi.fn(() => ({ returning: returningApplication }))
    const valuesForApplication = vi.fn(() => ({ onConflictDoNothing }))

    db.insert
      .mockImplementationOnce(() => ({ values: valuesForJob }))
      .mockImplementationOnce(() => ({ values: valuesForApplication }))
    db.select.mockImplementationOnce(() => ({
      from: () => ({
        where: vi.fn().mockResolvedValue([{
          preferences: {
            auto_generate_cv_on_job_add: true,
            auto_generate_cover_letter_on_job_add: false,
          },
        }]),
      }),
    }))
    enqueueGeneration.mockResolvedValue({ jobId: "generation-1", deduped: false })

    await persistJobForUser("user-1", {
      url: "https://example.com/job-2",
      source: "linkedin",
      title: "Product Engineer",
      company: "Beta",
    })

    expect(enqueueGeneration).toHaveBeenCalledOnce()
    expect(enqueueGeneration).toHaveBeenCalledWith({
      kind: "cv_tailor",
      userId: "user-1",
      applicationId: "app-2",
    })
  })

  it("queues a cover letter independently when only that automation is enabled", async () => {
    const returningCachedJob = vi.fn().mockResolvedValue([{ id: "job-3" }])
    const onConflictDoUpdate = vi.fn(() => ({ returning: returningCachedJob }))
    const returningApplication = vi.fn().mockResolvedValue([{ id: "app-3" }])
    const onConflictDoNothing = vi.fn(() => ({ returning: returningApplication }))

    db.insert
      .mockImplementationOnce(() => ({ values: vi.fn(() => ({ onConflictDoUpdate })) }))
      .mockImplementationOnce(() => ({ values: vi.fn(() => ({ onConflictDoNothing })) }))
    db.select.mockImplementationOnce(() => ({
      from: () => ({
        where: vi.fn().mockResolvedValue([{
          preferences: {
            auto_generate_cv_on_job_add: false,
            auto_generate_cover_letter_on_job_add: true,
          },
        }]),
      }),
    }))
    enqueueGeneration.mockResolvedValue({ jobId: "generation-2", deduped: false })

    await persistJobForUser("user-1", {
      url: "https://example.com/job-3",
      source: "linkedin",
      title: "Software Engineer",
      company: "Gamma",
    })

    expect(enqueueGeneration).toHaveBeenCalledOnce()
    expect(enqueueGeneration).toHaveBeenCalledWith({
      kind: "cover_letter",
      userId: "user-1",
      applicationId: "app-3",
    })
  })

  it("keeps the saved job and attempts both automations when one enqueue fails", async () => {
    const returningCachedJob = vi.fn().mockResolvedValue([{ id: "job-4" }])
    const onConflictDoUpdate = vi.fn(() => ({ returning: returningCachedJob }))
    const returningApplication = vi.fn().mockResolvedValue([{ id: "app-4" }])
    const onConflictDoNothing = vi.fn(() => ({ returning: returningApplication }))

    db.insert
      .mockImplementationOnce(() => ({ values: vi.fn(() => ({ onConflictDoUpdate })) }))
      .mockImplementationOnce(() => ({ values: vi.fn(() => ({ onConflictDoNothing })) }))
    db.select.mockImplementationOnce(() => ({
      from: () => ({
        where: vi.fn().mockResolvedValue([{
          preferences: {
            auto_generate_cv_on_job_add: true,
            auto_generate_cover_letter_on_job_add: true,
          },
        }]),
      }),
    }))
    enqueueGeneration
      .mockRejectedValueOnce(new Error("queue unavailable"))
      .mockResolvedValueOnce({ jobId: "generation-4", deduped: false })

    const result = await persistJobForUser("user-1", {
      url: "https://example.com/job-4",
      source: "linkedin",
      title: "Platform Engineer",
      company: "Delta",
    })

    expect(result).toEqual({ applicationId: "app-4", alreadySaved: false })
    expect(enqueueGeneration).toHaveBeenCalledTimes(2)
    expect(enqueueGeneration).toHaveBeenNthCalledWith(2, {
      kind: "cover_letter",
      userId: "user-1",
      applicationId: "app-4",
    })
  })

  it("records a transition event when application status changes", async () => {
    db.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([{ id: "app-1", status: "applied", appliedAt: null }]),
        }),
      }),
    }))

    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const set = vi.fn(() => ({ where: updateWhere }))
    db.update.mockImplementationOnce(() => ({ set }))

    const values = vi.fn().mockResolvedValue(undefined)
    db.insert.mockImplementationOnce(() => ({ values }))

    const result = await updateApplicationStatusForUser("user-1", "app-1", "interview")

    expect(result).toBe(true)
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "interview" }))
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      applicationId: "app-1",
      fromStatus: "applied",
      toStatus: "interview",
    }))
  })

  it("records a backward transition event when an application moves to a previous stage", async () => {
    db.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([{ id: "app-1", status: "interview", appliedAt: new Date() }]),
        }),
      }),
    }))

    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const set = vi.fn(() => ({ where: updateWhere }))
    db.update.mockImplementationOnce(() => ({ set }))

    const values = vi.fn().mockResolvedValue(undefined)
    db.insert.mockImplementationOnce(() => ({ values }))

    const result = await updateApplicationStatusForUser("user-1", "app-1", "screening")

    expect(result).toBe(true)
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "screening" }))
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      applicationId: "app-1",
      fromStatus: "interview",
      toStatus: "screening",
    }))
  })

  it("does not record a transition event when status is unchanged", async () => {
    db.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([{ id: "app-1", status: "applied", appliedAt: null }]),
        }),
      }),
    }))

    const result = await updateApplicationStatusForUser("user-1", "app-1", "applied")

    expect(result).toBe(true)
    expect(db.update).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })
})
