import React from "react"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

function MockNotesCard({ onSave }: { onSave: () => Promise<void> }) {
  const [saved, setSaved] = React.useState(false)
  async function handleSave() {
    await onSave()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSave() }}>
      <textarea onChange={() => setSaved(false)} data-testid="notes" />
      <button type="submit">Save notes</button>
      {saved && <span data-testid="saved-indicator">Saved</span>}
    </form>
  )
}

describe("NotesCard saved/cleared feedback", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not show 'Saved' indicator initially", () => {
    render(<MockNotesCard onSave={() => Promise.resolve()} />)
    expect(screen.queryByTestId("saved-indicator")).toBeNull()
  })

  it("shows 'Saved' indicator after form submit", async () => {
    render(<MockNotesCard onSave={() => Promise.resolve()} />)
    await act(async () => {
      fireEvent.submit(screen.getByText("Save notes").closest("form")!)
    })
    expect(screen.getByTestId("saved-indicator")).toBeTruthy()
  })

  it("clears 'Saved' indicator immediately when user types", async () => {
    render(<MockNotesCard onSave={() => Promise.resolve()} />)
    // First save to show the indicator
    await act(async () => {
      fireEvent.submit(screen.getByText("Save notes").closest("form")!)
    })
    expect(screen.getByTestId("saved-indicator")).toBeTruthy()

    // Typing clears it right away (no timer needed)
    act(() => {
      fireEvent.change(screen.getByTestId("notes"), { target: { value: "new text" } })
    })
    expect(screen.queryByTestId("saved-indicator")).toBeNull()
  })

  it("clears 'Saved' indicator after 2 seconds", async () => {
    render(<MockNotesCard onSave={() => Promise.resolve()} />)
    await act(async () => {
      fireEvent.submit(screen.getByText("Save notes").closest("form")!)
    })
    expect(screen.getByTestId("saved-indicator")).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByTestId("saved-indicator")).toBeNull()
  })
})
