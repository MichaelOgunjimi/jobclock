import { fireEvent, render, screen } from "@testing-library/react"
import { useRef } from "react"
import { describe, expect, it, vi } from "vitest"
import { useDismissibleLayer } from "@/hooks/use-dismissible-layer"

function Harness({
  enabled = true,
  onDismiss,
}: {
  enabled?: boolean
  onDismiss: () => void
}) {
  const layerRef = useRef<HTMLDivElement>(null)

  useDismissibleLayer({
    enabled,
    onDismiss,
    refs: [layerRef],
  })

  return (
    <div>
      <div ref={layerRef}>inside</div>
      <button type="button">outside</button>
    </div>
  )
}

describe("useDismissibleLayer", () => {
  it("dismisses when a pointer event lands outside the layer", () => {
    const onDismiss = vi.fn()

    render(<Harness onDismiss={onDismiss} />)

    fireEvent.pointerDown(screen.getByRole("button", { name: "outside" }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("does not dismiss when the pointer event starts inside the layer", () => {
    const onDismiss = vi.fn()

    render(<Harness onDismiss={onDismiss} />)

    fireEvent.pointerDown(screen.getByText("inside"))

    expect(onDismiss).not.toHaveBeenCalled()
  })

  it("dismisses on Escape only when enabled", () => {
    const onDismiss = vi.fn()

    render(<Harness enabled={false} onDismiss={onDismiss} />)
    fireEvent.keyDown(window, { key: "Escape" })
    expect(onDismiss).not.toHaveBeenCalled()

    render(<Harness onDismiss={onDismiss} />)
    fireEvent.keyDown(window, { key: "Escape" })

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
