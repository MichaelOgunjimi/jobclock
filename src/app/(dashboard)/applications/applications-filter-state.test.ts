import { describe, expect, it } from "vitest"
import {
  APPLICATIONS_FILTER_STATE_COOKIE,
  buildApplicationsFilterHref,
  getPersistedApplicationsFilterHref,
  hasApplicationsListParams,
  serializeApplicationsFilterState,
} from "./applications-filter-state"

describe("applications filter state", () => {
  it("exposes a stable cookie name for persisted list filters", () => {
    expect(APPLICATIONS_FILTER_STATE_COOKIE).toBe("applications-filter-state")
  })

  it("serializes only non-default filter values", () => {
    expect(
      serializeApplicationsFilterState({
        status: "all",
        sort: "saved_desc",
        q: "",
      })
    ).toBeNull()

    expect(
      serializeApplicationsFilterState({
        status: "applied",
        sort: "company_asc",
        q: "frontend engineer",
      })
    ).toBe("status=applied&sort=company_asc&q=frontend+engineer")
  })

  it("builds an applications href from filter state", () => {
    expect(buildApplicationsFilterHref("status=saved&q=react")).toBe(
      "/applications?status=saved&q=react"
    )
    expect(buildApplicationsFilterHref("")).toBe("/applications")
  })

  it("accepts only known persisted filters", () => {
    expect(getPersistedApplicationsFilterHref("status=interview&sort=applied_desc")).toBe(
      "/applications?status=interview&sort=applied_desc"
    )
    expect(getPersistedApplicationsFilterHref("status=definitely-not-real")).toBeNull()
    expect(getPersistedApplicationsFilterHref("sort=sideways")).toBeNull()
    expect(getPersistedApplicationsFilterHref("page=3")).toBeNull()
    expect(getPersistedApplicationsFilterHref("%")).toBeNull()
  })

  it("detects explicit list params so persisted state does not override them", () => {
    expect(hasApplicationsListParams({})).toBe(false)
    expect(hasApplicationsListParams({ page: "2" })).toBe(true)
    expect(hasApplicationsListParams({ status: "saved" })).toBe(true)
    expect(hasApplicationsListParams({ q: "designer" })).toBe(true)
  })
})
