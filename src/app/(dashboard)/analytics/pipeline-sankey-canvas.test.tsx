import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { PipelineSankeyCanvas } from "./pipeline-sankey-canvas"
import type { PipelineMetrics } from "../applications/pipeline-metrics"

const metrics: PipelineMetrics = {
  total: 3,
  active: 2,
  closed: 1,
  sent: 2,
  advanced: 1,
  statusCounts: {
    saved: 1,
    applied: 1,
    screening: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
    withdrawn: 1,
    ghosted: 0,
  },
}

describe("PipelineSankeyCanvas", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("pans the grouped diagram and resets it back home", () => {
    render(
      <PipelineSankeyCanvas
        metrics={metrics}
        links={[{ from: "saved", to: "applied", count: 1 }]}
        maxLinkCount={1}
        focusedStatus={null}
      />
    )

    const viewport = screen.getByTestId("sankey-viewport")
    expect(viewport).toHaveAttribute("transform", "translate(0 0)")

    fireEvent.pointerDown(screen.getByTestId("sankey-canvas"), {
      pointerId: 1,
      clientX: 20,
      clientY: 20,
    })
    fireEvent.pointerMove(screen.getByTestId("sankey-canvas"), {
      pointerId: 1,
      clientX: 55,
      clientY: 45,
    })
    fireEvent.pointerUp(screen.getByTestId("sankey-canvas"), {
      pointerId: 1,
      clientX: 55,
      clientY: 45,
    })

    expect(viewport).toHaveAttribute("transform", "translate(35 25)")

    fireEvent.click(screen.getByRole("button", { name: /reset sankey view/i }))

    expect(viewport).toHaveAttribute("transform", "translate(0 0)")
  })

  it("shows when the canvas layout is saved outside the default view", () => {
    render(
      <PipelineSankeyCanvas
        metrics={metrics}
        links={[{ from: "saved", to: "applied", count: 1 }]}
        maxLinkCount={1}
        focusedStatus={null}
      />
    )

    expect(screen.queryByText(/custom layout saved/i)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /zoom in sankey view/i }))

    expect(screen.getByText(/custom layout saved/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /reset sankey view/i }))

    expect(screen.queryByText(/custom layout saved/i)).not.toBeInTheDocument()
  })

  it("zooms the diagram in and out and resets scale", () => {
    render(
      <PipelineSankeyCanvas
        metrics={metrics}
        links={[{ from: "saved", to: "applied", count: 1 }]}
        maxLinkCount={1}
        focusedStatus={null}
      />
    )

    const zoomLayer = screen.getByTestId("sankey-zoom-layer")
    expect(zoomLayer).toHaveAttribute("transform", "scale(1)")
    expect(screen.getByTestId("sankey-zoom-level")).toHaveTextContent("100%")

    fireEvent.click(screen.getByRole("button", { name: /zoom in sankey view/i }))

    expect(zoomLayer).toHaveAttribute("transform", "scale(1.15)")
    expect(screen.getByTestId("sankey-zoom-level")).toHaveTextContent("115%")

    fireEvent.click(screen.getByRole("button", { name: /zoom out sankey view/i }))

    expect(zoomLayer).toHaveAttribute("transform", "scale(1)")

    fireEvent.click(screen.getByRole("button", { name: /zoom out sankey view/i }))
    fireEvent.click(screen.getByRole("button", { name: /reset sankey view/i }))

    expect(zoomLayer).toHaveAttribute("transform", "scale(1)")
  })

  it("moves an individual stage and resets it back into the grouped layout", () => {
    render(
      <PipelineSankeyCanvas
        metrics={metrics}
        links={[{ from: "saved", to: "applied", count: 1 }]}
        maxLinkCount={1}
        focusedStatus={null}
      />
    )

    const savedNode = screen.getByTestId("sankey-node-saved")
    expect(savedNode).toHaveAttribute("transform", "translate(44 154)")

    fireEvent.pointerDown(savedNode, {
      pointerId: 2,
      clientX: 50,
      clientY: 50,
    })
    fireEvent.pointerMove(savedNode, {
      pointerId: 2,
      clientX: 90,
      clientY: 70,
    })
    fireEvent.pointerUp(savedNode, {
      pointerId: 2,
      clientX: 90,
      clientY: 70,
    })

    expect(savedNode).toHaveAttribute("transform", "translate(84 174)")

    fireEvent.click(screen.getByRole("button", { name: /reset sankey view/i }))

    expect(savedNode).toHaveAttribute("transform", "translate(44 154)")
  })

  it("keeps the dragged and zoomed canvas state until reset clears it", async () => {
    const { unmount } = render(
      <PipelineSankeyCanvas
        metrics={metrics}
        links={[{ from: "saved", to: "applied", count: 1 }]}
        maxLinkCount={1}
        focusedStatus={null}
      />
    )

    await waitForSankeyViewRestore()

    fireEvent.pointerDown(screen.getByTestId("sankey-canvas"), {
      pointerId: 3,
      clientX: 20,
      clientY: 20,
    })
    fireEvent.pointerMove(screen.getByTestId("sankey-canvas"), {
      pointerId: 3,
      clientX: 50,
      clientY: 40,
    })
    fireEvent.pointerUp(screen.getByTestId("sankey-canvas"), {
      pointerId: 3,
      clientX: 50,
      clientY: 40,
    })

    fireEvent.click(screen.getByRole("button", { name: /zoom in sankey view/i }))

    const savedNode = screen.getByTestId("sankey-node-saved")
    fireEvent.pointerDown(savedNode, {
      pointerId: 4,
      clientX: 50,
      clientY: 50,
    })
    fireEvent.pointerMove(savedNode, {
      pointerId: 4,
      clientX: 73,
      clientY: 61.5,
    })
    fireEvent.pointerUp(savedNode, {
      pointerId: 4,
      clientX: 73,
      clientY: 61.5,
    })

    unmount()

    render(
      <PipelineSankeyCanvas
        metrics={metrics}
        links={[{ from: "saved", to: "applied", count: 1 }]}
        maxLinkCount={1}
        focusedStatus={null}
      />
    )

    await waitForSankeyViewRestore()

    await waitFor(() => {
      expect(screen.getByTestId("sankey-viewport")).toHaveAttribute("transform", "translate(30 20)")
      expect(screen.getByTestId("sankey-zoom-layer")).toHaveAttribute("transform", "scale(1.15)")
      expect(screen.getByTestId("sankey-node-saved")).toHaveAttribute("transform", "translate(64 164)")
    })

    fireEvent.click(screen.getByRole("button", { name: /reset sankey view/i }))

    expect(window.localStorage.getItem("jobclock:analytics:sankey-view")).toBeNull()
    expect(screen.getByTestId("sankey-viewport")).toHaveAttribute("transform", "translate(0 0)")
    expect(screen.getByTestId("sankey-zoom-layer")).toHaveAttribute("transform", "scale(1)")
    expect(screen.getByTestId("sankey-node-saved")).toHaveAttribute("transform", "translate(44 154)")
  })

  it("routes backward outcome links with an arrow toward the target", () => {
    render(
      <PipelineSankeyCanvas
        metrics={metrics}
        links={[{ from: "offer", to: "rejected", count: 1 }]}
        maxLinkCount={1}
        focusedStatus={null}
      />
    )

    const path = screen.getByTestId("sankey-link-offer-rejected")
    expect(path).toHaveAttribute("marker-end", "url(#sankey-arrow-rejected)")
    expect(path.getAttribute("d")).toContain("C 1012")
  })

  it("keeps arrowheads compact when paths get thick", () => {
    render(
      <PipelineSankeyCanvas
        metrics={metrics}
        links={[{ from: "saved", to: "applied", count: 26 }]}
        maxLinkCount={26}
        focusedStatus={null}
      />
    )

    const arrow = screen.getByTestId("sankey-arrow-marker-applied")
    expect(arrow).toHaveAttribute("markerUnits", "userSpaceOnUse")
    expect(arrow).toHaveAttribute("markerWidth", "9")
    expect(arrow).toHaveAttribute("markerHeight", "9")
  })

  it("keeps high volume paths readable instead of filling the canvas", () => {
    render(
      <PipelineSankeyCanvas
        metrics={metrics}
        links={[
          { from: "saved", to: "applied", count: 26 },
          { from: "saved", to: "screening", count: 1 },
        ]}
        maxLinkCount={26}
        focusedStatus={null}
      />
    )

    expect(screen.getByTestId("sankey-link-saved-applied")).toHaveAttribute("stroke-width", "16")
  })
})

function waitForSankeyViewRestore() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0)
  })
}
