import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { updateInterviewAt, toastError } = vi.hoisted(() => ({
  updateInterviewAt: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("./actions", () => ({ updateInterviewAt }))
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }))

import { InterviewDateCard } from "./interview-date-card"

describe("InterviewDateCard", () => {
  beforeEach(() => {
    updateInterviewAt.mockReset()
    toastError.mockReset()
  })

  it("shows the saved date in the input in the local timezone", () => {
    render(<InterviewDateCard applicationId="app-1" initialInterviewAt="2026-12-01T14:30:00.000Z" />)
    const expected = new Date("2026-12-01T14:30:00.000Z")
    const pad = (n: number) => String(n).padStart(2, "0")
    expect(screen.getByLabelText("Change date and time")).toHaveValue(
      `2026-12-01T${pad(expected.getHours())}:${pad(expected.getMinutes())}`.replace(
        "2026-12-01",
        `${expected.getFullYear()}-${pad(expected.getMonth() + 1)}-${pad(expected.getDate())}`,
      ),
    )
  })

  it("saves the chosen local time as a UTC ISO instant", async () => {
    updateInterviewAt.mockResolvedValue({})
    render(<InterviewDateCard applicationId="app-1" initialInterviewAt={null} />)

    const save = screen.getByRole("button", { name: "Save" })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText("Date and time"), { target: { value: "2026-12-01T09:30" } })
    fireEvent.click(save)

    await waitFor(() => expect(updateInterviewAt).toHaveBeenCalledTimes(1))
    expect(updateInterviewAt).toHaveBeenCalledWith("app-1", new Date("2026-12-01T09:30").toISOString())
    expect(await screen.findByRole("button", { name: "Clear" })).toBeInTheDocument()
  })

  it("clears the date", async () => {
    updateInterviewAt.mockResolvedValue({})
    render(<InterviewDateCard applicationId="app-1" initialInterviewAt="2026-12-01T14:30:00.000Z" />)

    fireEvent.click(screen.getByRole("button", { name: "Clear" }))

    await waitFor(() => expect(updateInterviewAt).toHaveBeenCalledWith("app-1", null))
    await waitFor(() => expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument())
  })

  it("surfaces a save error and keeps the draft", async () => {
    updateInterviewAt.mockResolvedValue({ error: "Enter a valid date and time" })
    render(<InterviewDateCard applicationId="app-1" initialInterviewAt={null} />)

    fireEvent.change(screen.getByLabelText("Date and time"), { target: { value: "2026-12-01T09:30" } })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Enter a valid date and time"))
    expect(screen.getByLabelText("Date and time")).toHaveValue("2026-12-01T09:30")
  })
})
