import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const { updateStatus } = vi.hoisted(() => ({ updateStatus: vi.fn() }))

vi.mock("./actions", () => ({ updateStatus }))

import { StatusStepper } from "./application-detail"

describe("application status loading feedback", () => {
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
})
