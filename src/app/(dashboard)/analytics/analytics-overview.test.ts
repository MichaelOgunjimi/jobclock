import { describe, expect, it } from "vitest"
import {
  buildAnalyticsOverviewCards,
  buildAnalyticsStatusFocusLinks,
  getAnalyticsEmptyState,
} from "./analytics-overview"

describe("buildAnalyticsOverviewCards", () => {
  it("keeps one concise analytics summary without duplicate total or active cards", () => {
    const cards = buildAnalyticsOverviewCards({
      total: 32,
      active: 28,
      sent: 3,
      closed: 4,
      interviews: 1,
      offers: 0,
    })

    expect(cards.map((card) => card.label)).toEqual([
      "Total applications",
      "Active",
      "In motion",
      "Closed",
      "Interviews",
      "Offers",
    ])
    expect(cards.filter((card) => card.label === "Total applications")).toHaveLength(1)
    expect(cards.filter((card) => card.label === "Active")).toHaveLength(1)
  })
})

describe("buildAnalyticsStatusFocusLinks", () => {
  it("builds analytics links that can set and clear the Sankey highlight", () => {
    const links = buildAnalyticsStatusFocusLinks("applied")

    expect(links[0]).toMatchObject({
      label: "All",
      href: "/analytics",
      active: false,
    })
    expect(links.find((link) => link.label === "Applied")).toMatchObject({
      href: "/analytics?status=applied",
      active: true,
    })
  })

  it("falls back to the all state for unknown focus values", () => {
    const links = buildAnalyticsStatusFocusLinks("not-real")

    expect(links[0]).toMatchObject({
      label: "All",
      href: "/analytics",
      active: true,
    })
    expect(links.some((link) => link.active && link.label !== "All")).toBe(false)
  })
})

describe("getAnalyticsEmptyState", () => {
  it("identifies when analytics has no applications yet", () => {
    expect(getAnalyticsEmptyState({ totalApplications: 0, transitionCount: 0 })).toBe("no-applications")
  })

  it("identifies when applications exist but movement history is not recorded yet", () => {
    expect(getAnalyticsEmptyState({ totalApplications: 3, transitionCount: 0 })).toBe("no-transitions")
  })

  it("does not return an empty state when applications and transitions exist", () => {
    expect(getAnalyticsEmptyState({ totalApplications: 3, transitionCount: 2 })).toBeNull()
  })
})
