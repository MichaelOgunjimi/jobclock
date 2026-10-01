import { beforeEach, describe, expect, it, vi } from "vitest"

const { db, enqueueGeneration, appendApplicationAuditEvents } = vi.hoisted(() => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
  enqueueGeneration: vi.fn(),
  appendApplicationAuditEvents: vi.fn(),
}))

vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/generation/enqueue", () => ({ enqueueGeneration }))
vi.mock("@/lib/applications/audit", () => ({ appendApplicationAuditEvents }))

import { persistJobForUser, updateApplicationStatusForUser } from "./persist-job"

describe("persistJobForUser", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.transaction.mockImplementation((callback) => callback(db))
  })

  function mockCurrentApplication(status: string, appliedAt: Date | null = null) {
    db.select.mockImplementationOnce(() => ({
      from: () => ({
        where: () => ({
          limit: () => ({
            for: vi.fn().mockResolvedValue([{ id: "app-1", status, appliedAt }]),
          }),
        }),
      }),
    }))
  }

  function mockStatusWrite() {
    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const set = vi.fn((value: Record<string, unknown>) => {
      void value
      return { where: updateWhere }
    })
    const values = vi.fn().mockResolvedValue(undefined)
    db.update.mockImplementationOnce(() => ({ set }))
    db.insert.mockImplementationOnce(() => ({ values }))
    return { set, values }
  }

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
    expect(appendApplicationAuditEvents).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        applicationId: "app-2",
        userId: "user-1",
        eventType: "application.created",
      }),
    )
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

  it("records every skipped forward stage and sets appliedAt atomically", async () => {
    mockCurrentApplication("saved")
    const { set, values } = mockStatusWrite()

    const result = await updateApplicationStatusForUser("user-1", "app-1", "interview")

    expect(result).toBe(true)
    expect(db.transaction).toHaveBeenCalledOnce()
    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      status: "interview",
      appliedAt: expect.any(Date),
      lastStatusUpdate: expect.any(Date),
    }))
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({ fromStatus: "saved", toStatus: "applied" }),
      expect.objectContaining({ fromStatus: "applied", toStatus: "screening" }),
      expect.objectContaining({ fromStatus: "screening", toStatus: "interview" }),
    ])

    const events = values.mock.calls[0][0]
    expect(events[0].createdAt.getTime()).toBeLessThan(events[1].createdAt.getTime())
    expect(events[1].createdAt.getTime()).toBeLessThan(events[2].createdAt.getTime())
    expect(set.mock.calls[0][0].appliedAt).toEqual(events[0].createdAt)
    expect(appendApplicationAuditEvents).toHaveBeenCalledWith(
      db,
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "application.status_changed",
          metadata: expect.objectContaining({ fromStatus: "saved", toStatus: "applied" }),
        }),
        expect.objectContaining({
          eventType: "application.status_changed",
          metadata: expect.objectContaining({ fromStatus: "screening", toStatus: "interview" }),
        }),
      ]),
    )
  })

  it("rejects ordinary backward transitions", async () => {
    mockCurrentApplication("interview", new Date())

    const result = await updateApplicationStatusForUser("user-1", "app-1", "screening")

    expect(result).toBe(false)
    expect(db.update).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("allows an explicit correction to a previous stage", async () => {
    mockCurrentApplication("interview", new Date())
    const { values } = mockStatusWrite()

    const result = await updateApplicationStatusForUser(
      "user-1",
      "app-1",
      "screening",
      "correction"
    )

    expect(result).toBe(true)
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({ fromStatus: "interview", toStatus: "screening" }),
    ])
  })

  it("requires explicit intent to reopen a closed application", async () => {
    const appliedAt = new Date("2026-09-01T10:00:00.000Z")
    mockCurrentApplication("rejected", appliedAt)

    expect(
      await updateApplicationStatusForUser("user-1", "app-1", "interview")
    ).toBe(false)

    mockCurrentApplication("rejected", appliedAt)
    const { values } = mockStatusWrite()
    expect(
      await updateApplicationStatusForUser("user-1", "app-1", "interview", "reopen")
    ).toBe(true)
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({ fromStatus: "rejected", toStatus: "interview" }),
    ])
  })

  it("records outcomes without replacing an existing applied timestamp", async () => {
    const appliedAt = new Date("2026-09-01T10:00:00.000Z")
    mockCurrentApplication("screening", appliedAt)
    const { set, values } = mockStatusWrite()

    const result = await updateApplicationStatusForUser("user-1", "app-1", "rejected")

    expect(result).toBe(true)
    expect(set).toHaveBeenCalledWith(expect.not.objectContaining({ appliedAt: expect.anything() }))
    expect(values).toHaveBeenCalledWith([
      expect.objectContaining({ fromStatus: "screening", toStatus: "rejected" }),
    ])
  })

  it("does not record a transition event when status is unchanged", async () => {
    mockCurrentApplication("applied")

    const result = await updateApplicationStatusForUser("user-1", "app-1", "applied")

    expect(result).toBe(true)
    expect(db.update).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })
})
