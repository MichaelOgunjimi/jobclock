import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const { refresh, updateJobDetail } = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateJobDetail: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }))
vi.mock("./actions", () => ({ updateJobDetail }))

import { InlineJobDetail } from "./application-detail"

describe("application job detail inline editing", () => {
  it("saves only the selected field and updates its displayed value", async () => {
    updateJobDetail.mockResolvedValueOnce({ success: true })
    render(
      <InlineJobDetail
        applicationId="app-1"
        field="company"
        label="company"
        extractedValue="Extracted Ltd"
        initialOverride={null}
        fallback="Unknown company"
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Edit company: Extracted Ltd" }))
    fireEvent.change(screen.getByRole("textbox", { name: "company" }), {
      target: { value: "Correct Ltd" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save company" }))

    await waitFor(() => expect(updateJobDetail).toHaveBeenCalledTimes(1))
    const formData = updateJobDetail.mock.calls[0][0] as FormData
    expect(Object.fromEntries(formData)).toEqual({
      applicationId: "app-1",
      field: "company",
      value: "Correct Ltd",
    })
    expect(await screen.findByRole("button", { name: "Edit company: Correct Ltd" })).toBeInTheDocument()
    expect(refresh).toHaveBeenCalled()
  })

  it("restores the original extracted value", async () => {
    updateJobDetail.mockResolvedValueOnce({ success: true })
    render(
      <InlineJobDetail
        applicationId="app-1"
        field="location"
        label="location"
        extractedValue="London"
        initialOverride="Remote"
        fallback="Add location"
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Edit location: Remote" }))
    fireEvent.click(screen.getByRole("button", { name: "Use extracted value" }))

    expect(await screen.findByRole("button", { name: "Edit location: London" })).toBeInTheDocument()
    const formData = updateJobDetail.mock.calls[0][0] as FormData
    expect(formData.get("useExtracted")).toBe("true")
  })
})
