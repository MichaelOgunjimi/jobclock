import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ApplicationActivity } from "./application-activity"

describe("ApplicationActivity", () => {
  it("renders the ordered application timeline without exposing content metadata", () => {
    render(<ApplicationActivity events={[
      {
        id: "event-2",
        eventType: "application.notes_updated",
        metadata: {
          changes: {
            notes: {
              before: { present: false, characters: 0 },
              after: { present: true, characters: 18 },
            },
          },
          forbiddenBody: "private note body",
        },
        createdAt: "2026-09-30T10:01:00.000Z",
      },
      {
        id: "event-1",
        eventType: "application.status_changed",
        metadata: { fromStatus: "saved", toStatus: "applied" },
        createdAt: "2026-09-30T10:00:00.000Z",
      },
    ]} />)

    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("Notes updated")
    expect(items[1]).toHaveTextContent("Saved → Applied")
    expect(screen.queryByText("private note body")).not.toBeInTheDocument()
    expect(screen.getAllByText(/You ·/)).toHaveLength(2)
  })
})
