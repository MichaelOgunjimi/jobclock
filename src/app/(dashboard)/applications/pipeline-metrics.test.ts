import { describe, expect, it } from "vitest"
import {
  buildPipelineFlowMetrics,
  buildPipelineMetrics,
  getApplicationStatusOption,
} from "./pipeline-metrics"

describe("buildPipelineMetrics", () => {
  it("counts applications across total, active, closed, and sent stages", () => {
    const metrics = buildPipelineMetrics([
      { status: "saved" },
      { status: "applied" },
      { status: "applied" },
      { status: "screening" },
      { status: "interview" },
      { status: "offer" },
      { status: "rejected" },
      { status: "withdrawn" },
    ])

    expect(metrics.total).toBe(8)
    expect(metrics.active).toBe(6)
    expect(metrics.closed).toBe(2)
    expect(metrics.sent).toBe(5)
    expect(metrics.statusCounts).toMatchObject({
      saved: 1,
      applied: 2,
      screening: 1,
      interview: 1,
      offer: 1,
      rejected: 1,
      withdrawn: 1,
    })
  })

  it("ignores unknown statuses and returns stable zero defaults", () => {
    const metrics = buildPipelineMetrics([
      { status: "saved" },
      { status: "not-a-real-status" },
      { status: null },
    ])

    expect(metrics.total).toBe(1)
    expect(metrics.active).toBe(1)
    expect(metrics.closed).toBe(0)
    expect(metrics.sent).toBe(0)
    expect(metrics.statusCounts.applied).toBe(0)
  })

  it("resolves valid status options for pipeline focus links", () => {
    expect(getApplicationStatusOption("applied")?.label).toBe("Applied")
    expect(getApplicationStatusOption("not-a-real-status")).toBeNull()
    expect(getApplicationStatusOption(null)).toBeNull()
  })

  it("counts recorded status transitions for Sankey links", () => {
    const flow = buildPipelineFlowMetrics([
      { fromStatus: "applied", toStatus: "screening" },
      { fromStatus: "applied", toStatus: "screening" },
      { fromStatus: "screening", toStatus: "interview" },
      { fromStatus: "interview", toStatus: "rejected" },
      { fromStatus: "applied", toStatus: "ghosted" },
      { fromStatus: null, toStatus: "saved" },
      { fromStatus: "unknown", toStatus: "saved" },
    ])

    expect(flow.links).toEqual([
      { from: "applied", to: "screening", count: 2 },
      { from: "screening", to: "interview", count: 1 },
      { from: "interview", to: "rejected", count: 1 },
      { from: "applied", to: "ghosted", count: 1 },
    ])
    expect(flow.maxLinkCount).toBe(2)
  })

  it("starts Sankey flows from saved instead of a synthetic start node", () => {
    const flow = buildPipelineFlowMetrics([
      { fromStatus: null, toStatus: "saved" },
      { fromStatus: null, toStatus: "applied" },
      { fromStatus: "saved", toStatus: "applied" },
      { fromStatus: null, toStatus: "rejected" },
    ])

    expect(flow.links).toEqual([
      { from: "saved", to: "applied", count: 2 },
      { from: "saved", to: "rejected", count: 1 },
    ])
    expect(flow.maxLinkCount).toBe(2)
  })
})
