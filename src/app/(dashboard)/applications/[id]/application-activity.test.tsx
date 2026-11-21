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

  it("labels archive, restore, tag, source and applied-date events", () => {
    const at = "2026-09-30T10:00:00.000Z"
    render(<ApplicationActivity events={[
      { id: "5", eventType: "application.archived", metadata: {}, createdAt: at },
      { id: "4", eventType: "application.restored", metadata: {}, createdAt: at },
      { id: "3", eventType: "application.tags_updated", metadata: { changes: { tags: { before: [], after: ["a"] } } }, createdAt: at },
      { id: "2", eventType: "application.source_updated", metadata: { changes: { source: { before: null, after: "Indeed" } } }, createdAt: at },
      { id: "1", eventType: "application.applied_at_updated", metadata: { changes: { appliedAt: { before: null, after: "2026-09-01T12:00:00.000Z" } } }, createdAt: at },
    ]} />)

    const items = screen.getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("Application archived")
    expect(items[1]).toHaveTextContent("Application restored")
    expect(items[2]).toHaveTextContent("Tags updated")
    expect(items[2]).toHaveTextContent("tags")
    expect(items[3]).toHaveTextContent("Source updated")
    expect(items[4]).toHaveTextContent("Applied date updated")
    expect(items[4]).toHaveTextContent("applied date")
  })
})
