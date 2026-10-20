import { describe, expect, it } from "vitest"
import {
  addRecentGlobalSearch,
  parseRecentGlobalSearches,
  rankGlobalSearchItems,
  type GlobalSearchItem,
} from "./global-search"

const items: GlobalSearchItem[] = [
  {
    id: "applications",
    type: "navigation",
    label: "Applications",
    description: "Review saved roles",
    href: "/applications",
  },
  {
    id: "analytics",
    type: "navigation",
    label: "Analytics",
    description: "Pipeline reporting",
    href: "/analytics",
  },
  {
    id: "cv",
    type: "cv",
    label: "Platform Engineer CV",
    description: "Saved CV",
    href: "/profile/cv-1",
  },
]

describe("global search", () => {
  it("ranks exact and prefix matches before fuzzy matches", () => {
    expect(rankGlobalSearchItems("applications", items).map((item) => item.id)).toEqual([
      "applications",
    ])
    expect(rankGlobalSearchItems("ana", items)[0]?.id).toBe("analytics")
  })

  it("matches ordered fuzzy characters and multiple fields", () => {
    expect(rankGlobalSearchItems("aplcatons", items)[0]?.id).toBe("applications")
    expect(rankGlobalSearchItems("platform cv", items)[0]?.id).toBe("cv")
  })

  it("deduplicates and caps recent searches", () => {
    expect(
      addRecentGlobalSearch(["React", "Design", "API", "Remote", "London"], "react"),
    ).toEqual(["react", "Design", "API", "Remote", "London"])
  })

  it("ignores invalid persisted recent-search data", () => {
    expect(parseRecentGlobalSearches("not json")).toEqual([])
    expect(parseRecentGlobalSearches(JSON.stringify([" React ", 3, ""]))).toEqual(["React"])
  })
})
