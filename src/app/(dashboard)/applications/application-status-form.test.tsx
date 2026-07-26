import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ApplicationStatusForm } from "./application-status-form"

const statusOptions = [
  { value: "saved", label: "Saved", color: "", dot: "" },
  { value: "applied", label: "Applied", color: "", dot: "" },
]

describe("ApplicationStatusForm", () => {
  it("shows and disables controls while a list-page status update is pending", async () => {
    let finishUpdate: (() => void) | undefined
    const action = () => new Promise<void>((resolve) => {
      finishUpdate = resolve
    })

    render(
      <ApplicationStatusForm
        applicationId="app-1"
        currentStatus="saved"
        statusOptions={statusOptions}
        action={action}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Update stage" }))

    expect(screen.getByRole("button", { name: "Updating stage…" })).toBeDisabled()
    expect(screen.getByRole("combobox", { name: "Stage" })).toBeDisabled()

    finishUpdate?.()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Update stage" })).toBeEnabled()
    })
  })
})
