import { beforeEach, describe, expect, it, vi } from "vitest"

const { db } = vi.hoisted(() => ({
  db: { select: vi.fn(), update: vi.fn() },
}))
vi.mock("@/lib/db", () => ({ db }))
vi.mock("./jobs", () => ({
  markRunning: vi.fn(),
  markDone: vi.fn(),
  markFailed: vi.fn(),
}))
vi.mock("./handlers", () => ({ getHandler: vi.fn(), registerHandler: vi.fn() }))
// dispatch imports ./register for its side effect; stub it so this suite tests
// runJob in isolation (registration has its own test in dispatch-registration).
vi.mock("./register", () => ({}))

import { markRunning, markDone, markFailed } from "./jobs"
import { getHandler } from "./handlers"
import { runJob } from "./dispatch"

function mockJobRow(job: Record<string, unknown> | undefined) {
  db.select.mockReturnValue({
    from: () => ({ where: vi.fn().mockResolvedValue(job ? [job] : []) }),
  })
}

describe("runJob", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("marks running, runs the handler, then marks done with the result ref", async () => {
    mockJobRow({ id: "job-1", kind: "cover_letter" })
    const handler = vi.fn().mockResolvedValue("cover-letter-99")
    vi.mocked(getHandler).mockReturnValue(handler)

    await runJob("job-1")

    expect(markRunning).toHaveBeenCalledWith("job-1")
    expect(getHandler).toHaveBeenCalledWith("cover_letter")
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: "job-1" }))
    expect(markDone).toHaveBeenCalledWith("job-1", "cover-letter-99")
    expect(markFailed).not.toHaveBeenCalled()
  })

  it("marks failed and rethrows when the handler throws (so QStash retries)", async () => {
    mockJobRow({ id: "job-2", kind: "cv_tailor" })
    vi.mocked(getHandler).mockReturnValue(
      vi.fn().mockRejectedValue(new Error("LLM exploded")),
    )

    await expect(runJob("job-2")).rejects.toThrow("LLM exploded")

    expect(markFailed).toHaveBeenCalledWith("job-2", "LLM exploded")
    expect(markDone).not.toHaveBeenCalled()
  })

  it("throws when the job id does not exist", async () => {
    mockJobRow(undefined)

    await expect(runJob("missing")).rejects.toThrow(/not found/i)
    expect(markRunning).not.toHaveBeenCalled()
  })
})
