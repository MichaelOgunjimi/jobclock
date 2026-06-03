import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}))

vi.mock("@/lib/db", () => ({ db }))

import { persistJobForUser, updateApplicationStatusForUser } from "./persist-job"

describe("persistJobForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
