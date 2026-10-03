import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ list: vi.fn(), update: vi.fn() }))

vi.mock("@/lib/jobs/persist-job", () => ({
  listRecentApplicationsForUser: mocks.list,
  updateApplicationStatusForUser: mocks.update,
}))

import { buildRecentList, resolveRecentCallback } from "./recent-jobs"

const job = {
  applicationId: "app-1",
  title: "Dev",
  company: "Acme",
  location: "London",
  status: "saved",
  applicationUrl: "https://x.test/applications/dev",
  postingUrl: "https://acme.test/jobs/1",
}

describe("telegram recent jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue([job])
  })

  it("renders the full list with a button per job", async () => {
    const { text, keyboard } = await buildRecentList("user-1")
    expect(text).toBe('🗂 <b>Your recent jobs</b>\n\n<b>Dev</b> at Acme\n📌 saved · <a href="https://x.test/applications/dev">Open in JobClock</a>')
    expect(keyboard).toEqual([[{ text: "Dev at Acme (saved)", callback_data: "j:app-1" }]])
  })

  it("shows links, forward statuses and Back for a tapped job", async () => {
    const view = await resolveRecentCallback("user-1", "j:app-1")
    const buttons = view!.keyboard!.flat()
    expect(view!.text).toBe("<b>Dev</b>\n🏢 Acme\n📍 London\n📌 saved")
    expect(buttons).toContainEqual({ text: "Open in JobClock", url: job.applicationUrl })
    expect(buttons).toContainEqual({ text: "Job posting", url: job.postingUrl })
    expect(buttons).toContainEqual({ text: "Mark applied", callback_data: "s:app-1:applied" })
    expect(buttons).not.toContainEqual(expect.objectContaining({ text: "Mark saved" }))
    expect(buttons).toContainEqual({ text: "← Back", callback_data: "r" })
  })

  it("changes status scoped to the tapping user, then re-renders", async () => {
    mocks.update.mockResolvedValue(true)
    const view = await resolveRecentCallback("user-1", "s:app-1:applied")
    expect(mocks.update).toHaveBeenCalledWith("user-1", "app-1", "applied")
    expect(view!.toast).toBe("Marked applied")
  })

  it("goes back to the list, and ignores unknown or foreign jobs", async () => {
    expect((await resolveRecentCallback("user-1", "r"))!.keyboard).toHaveLength(1)
    expect(await resolveRecentCallback("user-1", "x:whatever")).toBeNull()
    mocks.list.mockResolvedValue([])
    expect((await resolveRecentCallback("user-1", "j:other"))!.text).toContain("no longer in your recent list")
  })
})
