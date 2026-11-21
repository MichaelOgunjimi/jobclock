import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  archiveApplication: vi.fn(),
  restoreApplication: vi.fn(),
  updateTags: vi.fn(),
  updateSource: vi.fn(),
  updateAppliedAt: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }))
vi.mock("sonner", () => ({ toast: mocks.toast }))
vi.mock("./actions", () => ({
  archiveApplication: mocks.archiveApplication,
  restoreApplication: mocks.restoreApplication,
  updateTags: mocks.updateTags,
  updateSource: mocks.updateSource,
  updateAppliedAt: mocks.updateAppliedAt,
}))

import { ArchiveButton, TrackingDetailsCard } from "./application-tracking"

beforeEach(() => {
  vi.clearAllMocks()
  for (const action of [mocks.archiveApplication, mocks.restoreApplication, mocks.updateTags, mocks.updateSource, mocks.updateAppliedAt]) {
    action.mockResolvedValue({})
  }
})

describe("ArchiveButton", () => {
  it("archives straight away (it is reversible) and refreshes", async () => {
    render(<ArchiveButton applicationId="app-1" archived={false} />)
    fireEvent.click(screen.getByRole("button", { name: "Archive" }))

    await waitFor(() => expect(mocks.archiveApplication).toHaveBeenCalledWith("app-1"))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
    expect(mocks.restoreApplication).not.toHaveBeenCalled()
    expect(mocks.toast.success).toHaveBeenCalledWith(expect.stringContaining("no reminders"))
  })

  it("offers Restore for an archived application", async () => {
    render(<ArchiveButton applicationId="app-1" archived />)
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Restore" }))

    await waitFor(() => expect(mocks.restoreApplication).toHaveBeenCalledWith("app-1"))
    expect(mocks.archiveApplication).not.toHaveBeenCalled()
  })

  it("shows the error and does not refresh when the action fails", async () => {
    mocks.archiveApplication.mockResolvedValueOnce({ error: "Application not found" })
    render(<ArchiveButton applicationId="app-1" archived={false} />)
    fireEvent.click(screen.getByRole("button", { name: "Archive" }))

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Application not found"))
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})

function renderCard(overrides: Partial<Parameters<typeof TrackingDetailsCard>[0]> = {}) {
  return render(<TrackingDetailsCard applicationId="app-1" tags={["remote"]} source="Indeed" appliedAt="2026-11-05T12:00:00.000Z" {...overrides} />)
}

describe("TrackingDetailsCard", () => {
  it("shows the limits and why in the hints", () => {
    renderCard()
    expect(screen.getByText(/Up to 20 tags, 30 characters each/)).toBeInTheDocument()
    expect(screen.getByText(/can't be before 2000 or more than a day ahead/)).toBeInTheDocument()
  })

  it("adds a tag and saves the whole list", async () => {
    renderCard()
    const save = screen.getByRole("button", { name: "Save tags" })
    expect(save).toBeDisabled()

    const input = screen.getAllByRole("textbox")[0]
    fireEvent.change(input, { target: { value: "dream job" } })
    fireEvent.keyDown(input, { key: "Enter" })
    fireEvent.click(screen.getByRole("button", { name: "Save tags" }))

    await waitFor(() => expect(mocks.updateTags).toHaveBeenCalledWith("app-1", ["remote", "dream job"]))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled())
  })

  it("blocks saving and explains when a tag is too long", () => {
    renderCard({ tags: [] })
    const input = screen.getAllByRole("textbox")[0]
    fireEvent.change(input, { target: { value: "x".repeat(31) } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(screen.getByRole("alert")).toHaveTextContent("at most 30 characters")
    expect(screen.getByRole("button", { name: "Save tags" })).toBeDisabled()
  })

  it("saves an edited source and can clear it", async () => {
    renderCard()
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "  LinkedIn " } })
    fireEvent.click(screen.getByRole("button", { name: "Save source" }))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    expect(mocks.updateSource).toHaveBeenCalledWith("app-1", "LinkedIn")

    fireEvent.click(screen.getByRole("button", { name: "Clear source" }))
    await waitFor(() => expect(mocks.updateSource).toHaveBeenLastCalledWith("app-1", null))
  })

  it("saves a changed applied date as YYYY-MM-DD and can clear it", async () => {
    renderCard()
    const date = screen.getByLabelText("Applied date")
    await waitFor(() => expect(date).not.toBeDisabled())
    fireEvent.change(date, { target: { value: "2026-11-01" } })
    fireEvent.click(screen.getByRole("button", { name: "Save date" }))
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1))
    expect(mocks.updateAppliedAt).toHaveBeenCalledWith("app-1", "2026-11-01")

    fireEvent.click(screen.getByRole("button", { name: "Clear applied date" }))
    await waitFor(() => expect(mocks.updateAppliedAt).toHaveBeenLastCalledWith("app-1", null))
  })

  it("rejects a far-future applied date before calling the server", async () => {
    renderCard({ appliedAt: null })
    const date = screen.getByLabelText("Applied date")
    await waitFor(() => expect(date).not.toBeDisabled())
    fireEvent.change(date, { target: { value: "2099-01-01" } })

    expect(screen.getByRole("alert")).toHaveTextContent("can't be in the future")
    expect(screen.getByRole("button", { name: "Save date" })).toBeDisabled()
    expect(mocks.updateAppliedAt).not.toHaveBeenCalled()
  })

  it("shows a server error without refreshing", async () => {
    mocks.updateSource.mockResolvedValueOnce({ error: "Application not found" })
    renderCard({ source: null })
    fireEvent.change(screen.getByLabelText("Source"), { target: { value: "Referral" } })
    fireEvent.click(screen.getByRole("button", { name: "Save source" }))

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Application not found"))
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
