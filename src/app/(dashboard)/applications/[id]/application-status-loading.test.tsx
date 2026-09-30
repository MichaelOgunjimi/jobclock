import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { updateStatus } = vi.hoisted(() => ({ updateStatus: vi.fn() }))

vi.mock("./actions", () => ({ updateStatus }))

import { StatusStepper } from "./application-detail"

describe("application status loading feedback", () => {
  beforeEach(() => {
    updateStatus.mockReset()
  })

  it("shows the loading spinner inside the selected status control", async () => {
    let finishUpdate: (() => void) | undefined
    updateStatus.mockReturnValueOnce(new Promise<void>((resolve) => {
      finishUpdate = resolve
    }))

    render(<StatusStepper currentStatus="saved" applicationId="app-1" />)

    fireEvent.click(screen.getAllByRole("button", { name: /Applied/ })[0])

    expect(screen.getAllByRole("button", { name: "Updating Applied" })).not.toHaveLength(0)
    expect(screen.getAllByRole("status", { name: "Updating Applied" })).not.toHaveLength(0)
    expect(screen.queryByText(/Updating stage to/)).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Updating Applied" })[0]).not.toHaveClass("cursor-wait")
    expect(screen.getAllByRole("button", { name: /Screening/ })[0]).toBeDisabled()

    finishUpdate?.()
    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "Updating Applied" })).not.toBeInTheDocument()
    })
  })

  it("keeps backward stages out of normal progress and labels corrections explicitly", async () => {
    updateStatus.mockResolvedValue(undefined)
    render(<StatusStepper currentStatus="interview" applicationId="app-1" />)

    expect(screen.getAllByRole("button", { name: "Screening" })[0]).toBeDisabled()
    fireEvent.click(screen.getByText("Correct current stage"))
    fireEvent.click(screen.getByRole("button", { name: "Correct to Screening" }))

    await waitFor(() => expect(updateStatus).toHaveBeenCalledOnce())
    const formData = updateStatus.mock.calls[0][0] as FormData
    expect(formData.get("status")).toBe("screening")
    expect(formData.get("intent")).toBe("correction")
  })

  it("requires an explicit reopen action for closed applications", async () => {
    updateStatus.mockResolvedValue(undefined)
    render(<StatusStepper currentStatus="rejected" applicationId="app-1" />)

    expect(screen.getAllByRole("button", { name: "Interview" })[0]).toBeDisabled()
    fireEvent.click(screen.getByText("Reopen application"))
    fireEvent.click(screen.getByRole("button", { name: "Reopen at Interview" }))

    await waitFor(() => expect(updateStatus).toHaveBeenCalledOnce())
    const formData = updateStatus.mock.calls[0][0] as FormData
    expect(formData.get("status")).toBe("interview")
    expect(formData.get("intent")).toBe("reopen")
  })
})
