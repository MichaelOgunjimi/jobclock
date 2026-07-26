import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const { updateStatus } = vi.hoisted(() => ({ updateStatus: vi.fn() }))

vi.mock("./actions", () => ({ updateStatus }))

import { StatusStepper } from "./application-detail"

describe("application status loading feedback", () => {
  it("announces and disables a pending detail-page status update", async () => {
    let finishUpdate: (() => void) | undefined
    updateStatus.mockReturnValueOnce(new Promise<void>((resolve) => {
      finishUpdate = resolve
    }))

    render(<StatusStepper currentStatus="saved" applicationId="app-1" />)

    fireEvent.click(screen.getAllByRole("button", { name: /Applied/ })[0])

    expect(screen.getByRole("status")).toHaveTextContent("Updating stage to Applied")
    expect(screen.getAllByRole("button", { name: /Screening/ })[0]).toBeDisabled()

    finishUpdate?.()
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument()
    })
  })
})
